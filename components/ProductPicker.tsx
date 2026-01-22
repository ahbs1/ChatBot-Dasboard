
import React from 'react';
import { Product } from '../types';
import { MOCK_PRODUCTS } from '../constants';
import { X, ShoppingBag, Send } from 'lucide-react';

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export const ProductPicker: React.FC<ProductPickerProps> = ({ onSelect, onClose }) => {
  return (
    <div className="absolute bottom-16 left-4 md:left-auto md:w-[400px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="bg-wa-header p-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <ShoppingBag size={18} className="text-wa-green" />
            Send Product Catalog
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={18} />
        </button>
      </div>
      
      <div className="max-h-[300px] overflow-y-auto p-2 bg-gray-50">
        <div className="grid grid-cols-1 gap-2">
            {MOCK_PRODUCTS.map(product => (
                <div 
                    key={product.id} 
                    onClick={() => onSelect(product)}
                    className="bg-white p-3 rounded-lg border border-gray-200 hover:border-wa-green hover:shadow-md cursor-pointer transition-all flex gap-3 group"
                >
                    <img src={product.image} alt={product.name} className="w-16 h-16 rounded object-cover bg-gray-100" />
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 text-sm group-hover:text-wa-green">{product.name}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">Rp {product.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center">
                         <div className="bg-gray-100 p-2 rounded-full text-gray-400 group-hover:bg-green-100 group-hover:text-green-600">
                             <Send size={16} />
                         </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
