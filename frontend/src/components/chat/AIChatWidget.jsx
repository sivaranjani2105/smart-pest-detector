import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Sparkles, User, Bot, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const AIChatWidget = ({ backendUrl, chatContext, setChatContext }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Hello! I am **Smart Pest Detector AI**, your virtual agronomist. How can I help you with your crops, soil, irrigation, or pests today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Hook to handle incoming target pest context from Scanner
  useEffect(() => {
    if (chatContext) {
      setIsOpen(true);
      const newSystemMessage = {
        id: Date.now(),
        sender: "bot",
        text: `I've loaded the details for the **${chatContext.species}** detection (#${chatContext.id || 'N/A'}).\n- **Life Stage**: ${chatContext.life_stage || 'adult'}\n- **Severity**: ${chatContext.severity || 'moderate'}\n- **Confidence**: ${Math.round(chatContext.confidence * 100)}%\n\nHow would you like to treat this infestation, or what questions do you have about it?`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, newSystemMessage]);
      setChatContext(null); // Reset sibling trigger
    }
  }, [chatContext, setChatContext]);

  // Suggested quick questions
  const quickQuestions = [
    "How do I control aphids naturally?",
    "Is 35% soil moisture enough?",
    "What does high PM2.5 mean for crops?",
    "How to manage fall armyworms?"
  ];

  // Auto-scroll messages to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      if (res.ok) {
        const data = await res.json();
        const botMessage = {
          id: Date.now() + 1,
          sender: "bot",
          text: data.response,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error("Chat endpoint returned error status.");
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage = {
        id: Date.now() + 1,
        sender: "bot",
        text: "I'm having trouble connecting to my central engine. Please try asking again shortly.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Render markdown-like text formatting for bold (**text**) and bullet lists (- item)
  const formatMessageText = (text) => {
    return text.split("\n").map((line, idx) => {
      // Handle headings
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="font-extrabold text-slate-800 text-xs mt-2 mb-1 uppercase tracking-wider">{line.replace("### ", "")}</h4>;
      }
      
      // Handle list items
      if (line.startsWith("- ")) {
        const itemText = line.replace("- ", "");
        return (
          <li key={idx} className="ml-3 list-disc text-slate-600 text-[11px] leading-relaxed my-0.5">
            {parseBoldText(itemText)}
          </li>
        );
      }

      // Handle normal paragraphs
      return (
        <p key={idx} className="text-slate-600 text-[11.5px] leading-relaxed my-1">
          {parseBoldText(line)}
        </p>
      );
    });
  };

  // Parse bold markdown syntax
  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="font-extrabold text-slate-800">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 border border-emerald-500 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 transition-all"
        id="btn-ai-chat-bubble"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <MessageSquare className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 w-[350px] sm:w-[380px] h-[500px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-4 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">Smart Pest Detector AI Assistant</h3>
                  <span className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider block">Agronomist Agent</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-start gap-2.5 max-w-[85%] ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Icon */}
                    <div className={`h-6.5 w-6.5 rounded-full flex items-center justify-center text-xs font-bold ${
                      msg.sender === "user" ? "bg-slate-200 text-slate-700" : "bg-emerald-600 text-white"
                    }`}>
                      {msg.sender === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    {/* Message Bubble */}
                    <div className={`p-3 rounded-2xl shadow-sm border text-left ${
                      msg.sender === "user"
                        ? "bg-slate-800 text-white border-slate-700 rounded-tr-none"
                        : "bg-white text-slate-700 border-slate-200/80 rounded-tl-none"
                    }`}>
                      <div className="space-y-1">
                        {formatMessageText(msg.text)}
                      </div>
                      <span className={`text-[8.5px] block text-right mt-1.5 font-medium ${
                        msg.sender === "user" ? "text-slate-400" : "text-slate-400"
                      }`}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Bot Typing Simulator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5 max-w-[80%]">
                    <div className="h-6.5 w-6.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm flex items-center space-x-1">
                      <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions & Input */}
            <div className="border-t border-slate-200 p-3 bg-white space-y-3">
              {/* Suggested Questions */}
              {messages.length === 1 && (
                <div className="space-y-1.5 pb-1">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Suggested Questions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className="text-[10px] bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-semibold px-2.5 py-1 rounded-full transition-all text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask agronomist about crops or soil..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 text-slate-700 font-medium"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center justify-center"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
