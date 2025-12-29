"use client";

import { useCallback, useRef, useState, useEffect } from "react";

export interface FileAttachment {
  id: string;
  file: File;
  preview: string | null;
  type: "image" | "document";
}

export interface FileUploadProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  maxFiles?: number;
}

// Supported file types
const SUPPORTED_IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SUPPORTED_DOCUMENTS = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGES, ...SUPPORTED_DOCUMENTS];

/**
 * File upload component with paste, camera capture, and gallery picker
 * Shows thumbnail previews for attached files
 */
export function FileUpload({
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
}: FileUploadProps) {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Generate unique ID
  const generateId = () => `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Get file type category
  const getFileType = (mimeType: string): "image" | "document" => {
    return SUPPORTED_IMAGES.includes(mimeType) ? "image" : "document";
  };

  // Create preview URL for images
  const createPreview = (file: File): string | null => {
    if (SUPPORTED_IMAGES.includes(file.type)) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  // Add files to attachments
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newAttachments: FileAttachment[] = [];
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        // Check if we've hit the max
        if (attachments.length + newAttachments.length >= maxFiles) break;

        // Validate file type
        if (!SUPPORTED_TYPES.includes(file.type)) continue;

        newAttachments.push({
          id: generateId(),
          file,
          preview: createPreview(file),
          type: getFileType(file.type),
        });
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      }
    },
    [attachments, maxFiles, onAttachmentsChange]
  );

  // Remove attachment
  const removeAttachment = useCallback(
    (id: string) => {
      const attachment = attachments.find((a) => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange]
  );

  // Handle paste event
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems) return;

      const files: File[] = [];
      for (const item of Array.from(clipboardItems)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && SUPPORTED_TYPES.includes(file.type)) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        event.preventDefault();
        addFiles(files);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  // Handle gallery input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
    // Reset input
    event.target.value = "";
    setShowMenu(false);
  };

  // Get document icon based on type
  const getDocumentIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") {
      return (
        <svg
          className="w-6 h-6 text-error"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
          <text x="8" y="16" fontSize="6" fill="currentColor" fontWeight="bold">
            PDF
          </text>
        </svg>
      );
    }
    return (
      <svg
        className="w-6 h-6 text-text-secondary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(",")}
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select files from gallery"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Capture photo"
      />

      {/* Attachment button with badge */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg
                   bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border transition-colors"
        aria-label={`Attach files${attachments.length > 0 ? ` (${attachments.length} attached)` : ""}`}
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        {/* Badge */}
        {attachments.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center
                          bg-accent text-bg-primary text-[9px] font-medium rounded-full px-0.5">
            {attachments.length}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="absolute bottom-full right-0 mb-2 bg-bg-secondary rounded-xl shadow-lg
                     border border-border overflow-hidden min-w-[180px] z-50"
          role="menu"
        >
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-text-primary
                       hover:bg-border transition-colors min-h-[44px]"
            role="menuitem"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Camera</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-text-primary
                       hover:bg-border transition-colors min-h-[44px]"
            role="menuitem"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Gallery</span>
          </button>

          <div className="border-t border-border">
            <p className="px-4 py-2 text-xs text-text-secondary">
              Or paste from clipboard (Ctrl+V)
            </p>
          </div>
        </div>
      )}

      {/* Preview thumbnails */}
      {attachments.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 flex gap-2 p-2 bg-bg-secondary rounded-xl
                       border border-border max-w-[280px] overflow-x-auto">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative flex-shrink-0">
              {attachment.type === "image" && attachment.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-bg-primary rounded-lg">
                  {getDocumentIcon(attachment.file.type)}
                </div>
              )}
              {/* Remove button */}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center
                           bg-error text-white rounded-full hover:opacity-90"
                aria-label={`Remove ${attachment.file.name}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
