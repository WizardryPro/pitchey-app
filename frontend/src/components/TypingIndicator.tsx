import React, { useState, useEffect, useRef } from 'react';
import { useTyping } from '@shared/contexts/WebSocketContext';

interface TypingIndicatorProps {
  conversationId: number;
  currentUserId?: number;
  maxDisplayUsers?: number;
  showAvatars?: boolean;
  className?: string;
}

interface TypingData {
  conversationId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

export function TypingIndicator({ 
  conversationId, 
  currentUserId, 
  maxDisplayUsers = 3,
  showAvatars = false,
  className = '' 
}: TypingIndicatorProps) {
  const { startTyping, stopTyping, subscribeToTyping } = useTyping(conversationId);
  const [typingUsers, setTypingUsers] = useState<TypingData[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTyping((typing: TypingData[]) => {
      // Filter out current user
      const otherUsersTyping = typing.filter(
        t => t.isTyping && (!currentUserId || t.userId !== currentUserId)
      );
      setTypingUsers(otherUsersTyping);
      setIsVisible(otherUsersTyping.length > 0);
    });

    return unsubscribe;
  }, [conversationId, currentUserId, subscribeToTyping]);

  const getTypingText = () => {
    const count = typingUsers.length;
    if (count === 0) return '';
    
    const displayUsers = typingUsers.slice(0, maxDisplayUsers);
    const remainingCount = count - maxDisplayUsers;
    
    if (count === 1) {
      return `${displayUsers[0].username} is typing...`;
    } else if (count === 2) {
      return `${displayUsers[0].username} and ${displayUsers[1].username} are typing...`;
    } else if (count <= maxDisplayUsers) {
      const lastUser = displayUsers.pop();
      const userList = displayUsers.map(u => u.username).join(', ');
      return `${userList}, and ${lastUser?.username} are typing...`;
    } else {
      const userList = displayUsers.map(u => u.username).join(', ');
      return `${userList} and ${remainingCount} other${remainingCount > 1 ? 's' : ''} are typing...`;
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 py-2 animate-fade-in ${className}`}>
      {showAvatars && (
        <div className="flex -space-x-2">
          {typingUsers.slice(0, maxDisplayUsers).map((user, index) => (
            <div
              key={user.userId}
              className="w-6 h-6 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
              style={{ zIndex: maxDisplayUsers - index }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <TypingDots />
        <span className="text-sm text-gray-500 italic">
          {getTypingText()}
        </span>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
}

interface TypingInputProps {
  conversationId: number;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  typingTimeout?: number;
}

export function TypingInput({ 
  conversationId,
  placeholder = "Type a message...",
  value = "",
  onChange,
  onSubmit,
  disabled = false,
  className = "",
  typingTimeout = 3000
}: TypingInputProps) {
  const { startTyping, stopTyping } = useTyping(conversationId);
  const [isTyping, setIsTyping] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        stopTyping();
      }
    };
  }, [isTyping, stopTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);

    // Start typing indicator if not already active
    if (!isTyping && newValue.trim()) {
      setIsTyping(true);
      startTyping();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (newValue.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        stopTyping();
      }, typingTimeout);
    } else {
      // Stop typing immediately if input is empty
      setIsTyping(false);
      stopTyping();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (internalValue.trim()) {
        onSubmit?.(internalValue.trim());
        setInternalValue("");
        onChange?.("");
      }
      
      // Stop typing indicator immediately after sending
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsTyping(false);
      stopTyping();
    }
  };

  const handleBlur = () => {
    // Stop typing when input loses focus
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    stopTyping();
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={internalValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
      />
      
      {/* Typing indicator for current user */}
      {isTyping && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TypingTextAreaProps {
  conversationId: number;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  rows?: number;
  typingTimeout?: number;
}

export function TypingTextArea({ 
  conversationId,
  placeholder = "Type your message...",
  value = "",
  onChange,
  disabled = false,
  className = "",
  rows = 3,
  typingTimeout = 3000
}: TypingTextAreaProps) {
  const { startTyping, stopTyping } = useTyping(conversationId);
  const [isTyping, setIsTyping] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        stopTyping();
      }
    };
  }, [isTyping, stopTyping]);

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);

    // Start typing indicator if not already active
    if (!isTyping && newValue.trim()) {
      setIsTyping(true);
      startTyping();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (newValue.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        stopTyping();
      }, typingTimeout);
    } else {
      // Stop typing immediately if input is empty
      setIsTyping(false);
      stopTyping();
    }
  };

  const handleBlur = () => {
    // Stop typing when textarea loses focus
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    stopTyping();
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        value={internalValue}
        onChange={handleTextAreaChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors resize-none"
      />
      
      {/* Typing indicator for current user */}
      {isTyping && (
        <div className="absolute right-3 bottom-3">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SmartTypingIndicatorProps {
  conversationId: number;
  children: React.ReactNode;
  currentUserId?: number;
  className?: string;
}

export function SmartTypingIndicator({ 
  conversationId, 
  children, 
  currentUserId,
  className = "" 
}: SmartTypingIndicatorProps) {
  return (
    <div className={className}>
      {children}
      <TypingIndicator 
        conversationId={conversationId} 
        currentUserId={currentUserId}
        className="mt-2"
      />
    </div>
  );
}

export default TypingIndicator;