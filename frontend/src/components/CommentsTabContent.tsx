import React, { useState, useCallback, useMemo } from 'react';

// Interfaces for Comment management
interface Comment {
    id: string; // ⚠️ Use string (UUID)
    userName: string;
    userInitials: string;
    timestamp: string;
    content: string;
}

interface CommentsTabContentProps {
    // ⚠️ CRITICAL CHANGE: onCommentAdded now expects only the comment content string
    onCommentAdded: (content: string) => void;
    initialComments: Comment[];
    currentUser: {
        name: string;
        initials: string;
    };
}

const CommentsTabContent: React.FC<CommentsTabContentProps> = ({ 
    initialComments, 
    onCommentAdded, 
    currentUser 
}) => {
    // State for the text input is local
    const [newComment, setNewComment] = useState('');

    // Use the comments prop as the source of truth for display
    // The comments list is managed by the parent (TaskDetailModal) via API responses
    const commentsList = useMemo(() => initialComments, [initialComments]);


    // 2. COMMENT SUBMISSION LOGIC
    const handleCommentSubmit = useCallback(() => {
        const content = newComment.trim();
        if (content === '') return;

        // 🚀 FIX: Call the parent function with ONLY the content string.
        // The parent (TaskDetailModal) will handle the API POST request,
        // user details, and timestamp generation.
        onCommentAdded(content); 

        // Clear local input state
        setNewComment('');
    }, [newComment, onCommentAdded]); // Removed currentUser from dependencies as it's not used in the callback body

    return (
        <div className="comments-tab-content space-y-4">
            
            {/* Comment Input Area */}
            <div className="comment-input-area flex items-end">
                <textarea 
                    className="comment-textarea w-full p-3 rounded-lg border resize-none"
                    rows={1}
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommentSubmit();
                        }
                    }}
                />
                <button 
                    className="comment-send-button flex-shrink-0 ml-2 w-12 h-12 rounded-lg"
                    onClick={handleCommentSubmit}
                    disabled={newComment.trim() === ''}
                >
                    <i className="fas fa-paper-plane text-white"></i>
                </button>
            </div>

            {/* Comment List / Placeholder */}
            <div className="comment-list mt-6 space-y-4">
                {commentsList.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                        No comments yet
                    </div>
                ) : (
                    // Displaying the list of comments from the parent state
                    commentsList.map(comment => (
                        // ⚠️ Use comment.id (string UUID) for the key
                        <div key={comment.id} className="comment-item flex space-x-3">
                            {/* User Avatar */}
                            <div className="user-avatar-comment flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {comment.userInitials}
                            </div>
                            
                            {/* Comment Body */}
                            <div className="comment-body flex-1">
                                <div className="flex items-baseline space-x-2 mb-1">
                                    <span className="font-semibold text-gray-800 text-sm">{comment.userName}</span>
                                    <span className="text-xs text-gray-500">{comment.timestamp}</span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-line">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CommentsTabContent;