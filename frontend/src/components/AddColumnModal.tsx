import React, { useState, useCallback } from 'react';

// Define the structure for a color theme, linking display name to CSS class/gradient
interface ColorTheme {
    name: string;
    class: string; // Custom CSS class for the background gradient
}

interface AddColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Callback to send the new column data back to the parent
    onColumnCreate: (title: string, theme: ColorTheme) => void;
}

// 1. Define the available color themes
const COLOR_THEMES: ColorTheme[] = [
    { name: 'Blue', class: 'theme-blue' },
    { name: 'Purple', class: 'theme-purple' },
    { name: 'Pink', class: 'theme-pink' },
    { name: 'Green', class: 'theme-green' },
    { name: 'Orange', class: 'theme-orange' },
    { name: 'Red', class: 'theme-red' },
    { name: 'Teal', class: 'theme-teal' },
    { name: 'Indigo', class: 'theme-indigo' },
];

const AddColumnModal: React.FC<AddColumnModalProps> = ({ isOpen, onClose, onColumnCreate }) => {
    
    const [columnTitle, setColumnTitle] = useState('');
    const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(COLOR_THEMES[0]); 

    const handleCreateColumn = useCallback(() => {
    // ⚠️ START DEBUG HERE
    console.log("[DEBUG] Create Column button clicked."); 
    
    if (!columnTitle.trim()) {
        alert("Column Title is required.");
        return;
    }

    // Call the parent handler with the new column data
    onColumnCreate(columnTitle.trim(), selectedTheme);
    
    // Reset state and close modal
    setColumnTitle('');
    setSelectedTheme(COLOR_THEMES[0]);
    onClose();
}, [columnTitle, selectedTheme, onColumnCreate, onClose]);


    return (
        <div className="modal-overlay">
            {/* The modal-content-small class is a new one for smaller modals */}
            <div className="modal-content modal-content-small">
                
                {/* Header (Title and Close Button) */}
                <div className="modal-header flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold">Add New Column</h2>
                    <button className="text-gray-400 hover:text-gray-700 text-2xl" onClick={onClose}>
                        <i className="fa fa-times"></i>
                    </button>
                </div>

                {/* Body Content */}
                <div className="modal-body p-6 space-y-6">
                    
                    {/* Column Title Input */}
                    <div className="input-group">
                        <label className="input-label text-sm font-bold mb-2 block">Column Title *</label>
                        <input 
                            type="text"
                            className="column-title-input w-full p-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            placeholder="e.g., In Progress"
                            value={columnTitle}
                            onChange={(e) => setColumnTitle(e.target.value)}
                        />
                    </div>

                    {/* Color Theme Selector */}
                    <div className="color-theme-selector">
                        <label className="input-label text-sm font-bold mb-3 block">Color Theme</label>
                        <div className="grid grid-cols-4 gap-4">
                            {COLOR_THEMES.map((theme) => (
                                <button
                                    key={theme.name}
                                    className={`color-swatch-button flex flex-col items-center p-1 rounded-xl transition duration-200 ${
                                        selectedTheme.name === theme.name ? 'swatch-selected' : 'swatch-unselected'
                                    }`}
                                    onClick={() => setSelectedTheme(theme)}
                                >
                                    <div className={`color-swatch w-full h-10 rounded-lg ${theme.class}`}></div>
                                    <span className="text-xs mt-1 text-gray-700 font-medium">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Footer (Action Buttons) */}
                <div className="modal-footer flex justify-end items-center p-4 border-t border-gray-200 space-x-3">
                    <button 
                        className="cancel-button px-6 py-2 rounded-lg font-semibold text-gray-700 transition hover:bg-gray-100"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    
                    <button 
                        className="create-column-button px-6 py-2 rounded-lg font-semibold text-white transition"
                        onClick={handleCreateColumn}
                        disabled={!columnTitle.trim()}
                    >
                        Create Column
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddColumnModal;