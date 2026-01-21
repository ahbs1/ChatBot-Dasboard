import React from 'react';
import { RAGDocument } from '../types';
import { Database, Zap } from 'lucide-react';

interface KnowledgePanelProps {
  documents: RAGDocument[];
  isVisible: boolean;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({ documents, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="w-80 border-l border-gray-200 bg-white h-full overflow-y-auto hidden xl:flex flex-col">
      <div className="p-4 border-b bg-gray-50 sticky top-0">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <Database size={18} className="text-purple-600" />
          Context (RAG)
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Knowledge chunks retrieved from Supabase Vector for the current conversation.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {documents.map((doc) => (
          <div key={doc.id} className="border border-purple-100 rounded-lg p-3 bg-purple-50 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                {doc.title}
              </span>
              <span className="flex items-center text-xs text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                <Zap size={10} className="mr-1 fill-purple-600" />
                {Math.round(doc.similarity * 100)}% Match
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {doc.content}
            </p>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            <p>No relevant context found.</p>
          </div>
        )}
      </div>
    </div>
  );
};