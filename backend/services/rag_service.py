import os
import re
import math
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RAGService")

DATABASE_DIR = os.path.join("data", "rag_database")

DEFAULT_GUIDANCE = (
    "### Regional Agricultural Extension Guidance\n"
    "- Always verify pest density thresholds before spraying: chemical treatment is recommended if infestation covers >15% of crop leaf area.\n"
    "- Prefer organic sprays (Neem oil, Bacillus thuringiensis) for young larvae stages to protect bees and beneficial insects.\n"
    "- Maintain optimal soil moisture (45% - 60%) to strengthen crop natural defenses against mites and leaf spotting pathogens."
)

class RAGService:
    def __init__(self):
        self.documents = {}
        # Ensure database directory exists
        if not os.path.exists(DATABASE_DIR):
            os.makedirs(DATABASE_DIR, exist_ok=True)
            self._seed_default_guidance()
        
        self.load_documents()

    def _seed_default_guidance(self):
        """Seeds the local folder with regional extension documents."""
        seeds = {
            "aphids.md": (
                "### Extension Guidance: Aphid Management (Aphis gossypii)\n"
                "- Economic Threshold: Treat if more than 20 aphids per leaf are counted.\n"
                "- Recommended Dosage: Apply Neem Oil at a rate of 5 ml per litre of water. Typically requires 2 litres of diluted spray mix per 10 square meters (approx 200 litres per acre).\n"
                "- Larvae stage treatment: Ladybugs release is highly effective. Avoid pyrethroid sprays to protect beneficial ladybugs."
            ),
            "locusts.md": (
                "### Extension Guidance: Desert Locust Management (Schistocerca gregaria)\n"
                "- Economic Threshold: Treat immediately if hopping bands or swarms are sighted.\n"
                "- Recommended Dosage: Use Metarhizium acridum biological pathogen at 50g per hectare, or Lambda-cyhalothrin at 20 ml per acre dissolved in 100 litres of water.\n"
                "- Stage-specific: Insect Growth Regulators (IGRs) like Diflubenzuron are highly recommended for immature hopper stages."
            ),
            "armyworms.md": (
                "### Extension Guidance: Fall Armyworm Management (Spodoptera frugiperda)\n"
                "- Economic Threshold: Treat if crop damage is visible on >10% of corn plants.\n"
                "- Recommended Dosage: Bacillus thuringiensis (Bt) at 2g per litre of water. Standard dilution is 150 litres per acre.\n"
                "- Stage-specific: Target early instar larvae with Bt or Spinosad. Chemical control is less effective on mature larvae hiding inside whorls."
            ),
            "spider_mites.md": (
                "### Extension Guidance: Spider Mite Management (Tetranychus urticae)\n"
                "- Economic Threshold: Treat if fine webbing is visible on leaf undersides of >5% of plants.\n"
                "- Recommended Dosage: Spray Abamectin at 0.5 ml per litre of water. Requires 150 litres of mix per acre.\n"
                "- Preventive practices: Mitigate dry dusty road borders which attract mites by maintaining perimeter misting."
            )
        }
        for name, text in seeds.items():
            path = os.path.join(DATABASE_DIR, name)
            try:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)
                logger.info(f"Seeded default RAG doc: {name}")
            except Exception as e:
                logger.error(f"Failed to seed {name}: {e}")

    def load_documents(self):
        """Loads all markdown guidance documents from disk."""
        self.documents = {}
        if not os.path.exists(DATABASE_DIR):
            return
        
        for file in os.listdir(DATABASE_DIR):
            if file.endswith(".md"):
                path = os.path.join(DATABASE_DIR, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        self.documents[file] = f.read()
                except Exception as e:
                    logger.error(f"Error reading RAG doc {file}: {e}")
        logger.info(f"Loaded {len(self.documents)} RAG documents into memory.")

    def _tokenize(self, text):
        """Tokenize text into cleaned lowercase word tokens."""
        return re.findall(r'[a-z0-9]+', text.lower())

    def query_guidance(self, query):
        """
        Calculates simple token overlaps (RAG TF-IDF Cosine Matcher mock)
        to return the most relevant agricultural extension file.
        """
        if not self.documents:
            return DEFAULT_GUIDANCE
            
        query_tokens = set(self._tokenize(query))
        if not query_tokens:
            return DEFAULT_GUIDANCE
            
        best_doc = None
        max_score = 0
        
        for name, content in self.documents.items():
            doc_tokens = self._tokenize(content)
            doc_token_counts = {}
            for t in doc_tokens:
                doc_token_counts[t] = doc_token_counts.get(t, 0) + 1
                
            # Compute intersection token score
            score = 0
            for t in query_tokens:
                if t in doc_token_counts:
                    # Score is term frequency weighted
                    score += 1 + math.log(doc_token_counts[t])
                    
            if score > max_score:
                max_score = score
                best_doc = content
                
        # Return best matching document, or generic guidance if score is negligible
        if best_doc and max_score > 1.5:
            return best_doc
        return DEFAULT_GUIDANCE

# Singleton instance
rag_service = RAGService()
