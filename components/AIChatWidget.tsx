import React, { useState, useRef, useEffect } from 'react';
import { Property, ChatMessage } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';
import { answerQuestionAboutProperties } from '../services/geminiService';

interface AIChatWidgetProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({ properties, onSelectProperty }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const handleToggle = () => setIsOpen(!isOpen);

  const handlePropertyClick = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    if (property) {
      onSelectProperty(property);
      setIsOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { id: Date.now(), sender: 'user', type: 'text', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const aiResponse = await answerQuestionAboutProperties(input, properties);
      
      let aiMessage: ChatMessage;
      if (typeof aiResponse === 'string') {
        aiMessage = { id: Date.now() + 1, sender: 'ai', type: 'text', text: aiResponse };
      } else {
        aiMessage = { id: Date.now() + 1, sender: 'ai', type: 'property_list', properties: aiResponse.properties };
      }
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { id: Date.now() + 1, sender: 'ai', type: 'text', text: 'Lo siento, no pude procesar tu pregunta en este momento.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`fixed bottom-4 right-4 bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white rounded-full p-4 shadow-lg transform transition-all duration-300 z-40 ${isOpen ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`}
        aria-label="Abrir Asistente IA"
      >
        <SparklesIcon className="h-8 w-8" />
      </button>

      <div className={`fixed bottom-4 right-4 w-[calc(100%-2rem)] max-w-md h-[70vh] max-h-[600px] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right z-50 ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] rounded-t-lg">
          <h3 className="font-bold text-[var(--text-primary)]">Asistente IA</h3>
          <button onClick={handleToggle} className="text-[var(--text-secondary)] hover:text-white p-2 -mr-2">&times;</button>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.length === 0 && (
             <div className="text-center text-[var(--text-tertiary)] h-full flex items-center justify-center">
                <p className="text-sm">Haz una pregunta sobre las propiedades. <br/>Ej: "¿Cuál es la más cara en Caballito?"</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs md:max-w-sm px-3 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-[var(--primary-accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>
                {msg.type === 'text' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold mb-2">Aquí tienes los resultados:</p>
                    {msg.properties.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => handlePropertyClick(p.id)}
                        className="w-full text-left bg-gray-600 hover:bg-gray-500 p-2 rounded-md transition-colors"
                      >
                        <p className="text-sm font-bold text-[var(--primary-accent-text)] truncate">{p.title}</p>
                        <p className="text-xs text-gray-400">{p.location} - USD {p.price.toLocaleString('es-ar')}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="max-w-xs md:max-w-sm px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                  <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-2 sm:p-4 border-t border-[var(--border-primary)]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)]"
          />
        </form>
      </div>
    </>
  );
};