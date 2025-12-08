"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Eraser, Trash2, Undo, Redo, Highlighter, Plus, Check } from "lucide-react";

interface DrawingCanvasProps {
    width: number;
    height: number;
    onSave?: (dataUrl: string) => void;
    storageKey?: string; // Unique key for saving/loading drawings
    readOnly?: boolean; // If true, only display drawing without toolbar or interaction
    toolbarPortalId?: string; // ID of element to portal toolbar into (for sticky positioning)
}

type Tool = "pen" | "eraser" | "highlighter";
type DrawingAction = {
    tool: Tool;
    points: { x: number; y: number }[];
    color: string;
    width: number;
};

const DEFAULT_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#000000"];

export function DrawingCanvas({ width, height, onSave, storageKey, readOnly = false }: DrawingCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<Tool>("pen");
    const [penColor, setPenColor] = useState("#3b82f6"); // blue-500
    const [penWidth, setPenWidth] = useState(2);
    const [history, setHistory] = useState<DrawingAction[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Straight line features
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isStraightened, setIsStraightened] = useState(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);

    // Custom color palette
    const [customColors, setCustomColors] = useState<string[]>([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [tempColor, setTempColor] = useState("#ff0000");
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Load saved drawing when storageKey changes
    useEffect(() => {
        if (!storageKey) return;

        // Reset state for new key
        setHistory([]);
        setHistoryIndex(-1);
        setCurrentAction(null);
        setIsLoaded(false);

        // Clear canvas immediately
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
            ctx.clearRect(0, 0, width, height);
        }

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const savedHistory = JSON.parse(saved) as DrawingAction[];
                setHistory(savedHistory);
                setHistoryIndex(savedHistory.length - 1);
            }
        } catch (error) {
            console.error('Failed to load drawing:', error);
        }

        // Mark as loaded after a brief delay to ensure first save works
        setTimeout(() => setIsLoaded(true), 100);
    }, [storageKey, width, height]);

    // Auto-save to localStorage whenever history changes
    useEffect(() => {
        if (!storageKey || !isLoaded) return;

        try {
            const currentHistory = history.slice(0, historyIndex + 1);
            localStorage.setItem(storageKey, JSON.stringify(currentHistory));
        } catch (error) {
            console.error('Failed to save drawing:', error);
        }
    }, [history, historyIndex, storageKey, isLoaded]);

    // Load custom colors from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('drawing-custom-colors');
            if (saved) {
                setCustomColors(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load custom colors:', error);
        }
    }, []);

    // Save custom colors to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('drawing-custom-colors', JSON.stringify(customColors));
        } catch (error) {
            console.error('Failed to save custom colors:', error);
        }
    }, [customColors]);

    // Track Shift key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setShowColorPicker(false);
            }
        };

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorPicker]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Redraw all actions up to current index
        history.slice(0, historyIndex + 1).forEach(action => {
            drawAction(ctx, action);
        });

        // Draw current action
        if (currentAction) {
            drawAction(ctx, currentAction);
        }
    }, [history, historyIndex, width, height, currentAction]);

    const drawAction = (ctx: CanvasRenderingContext2D, action: DrawingAction) => {
        if (action.points.length < 2) return;

        ctx.strokeStyle = action.tool === "eraser" ? "#ffffff" : action.color;

        if (action.tool === "highlighter") {
            ctx.lineWidth = action.width * 4; // Thicker for highlighter
            ctx.globalAlpha = 0.4; // Transparent
            ctx.globalCompositeOperation = "source-over"; // Blend
        } else if (action.tool === "eraser") {
            ctx.lineWidth = action.width * 3;
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = "destination-out";
        } else {
            ctx.lineWidth = action.width;
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = "source-over";
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);

        for (let i = 1; i < action.points.length; i++) {
            ctx.lineTo(action.points[i].x, action.points[i].y);
        }

        ctx.stroke();

        // Reset context
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (readOnly) return;

        // Check if this is a pen/stylus input (not finger touch)
        // Use pointerType or force property to detect stylus
        if ('touches' in e) {
            const touch = e.touches[0] as Touch & { touchType?: string };
            // Check touchType if available (experimental), or use radiusX/radiusY to detect finger vs stylus
            // Finger touches typically have larger touch radius than stylus
            const isFinger = touch.touchType === 'direct' ||
                           (touch.radiusX !== undefined && touch.radiusX > 10);

            if (isFinger) {
                // This is a finger touch, ignore it to allow scrolling
                return;
            }
        }

        e.preventDefault();
        const coords = getCoordinates(e);
        setIsDrawing(true);
        setIsStraightened(false);
        startPointRef.current = coords;

        setCurrentAction({
            tool,
            points: [coords],
            color: penColor,
            width: penWidth
        });
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (readOnly) return;

        // Check if this is a pen/stylus input (not finger touch)
        if ('touches' in e) {
            const touch = e.touches[0] as Touch & { touchType?: string };
            const isFinger = touch.touchType === 'direct' ||
                           (touch.radiusX !== undefined && touch.radiusX > 10);

            if (isFinger) {
                // This is a finger touch, ignore it to allow scrolling
                return;
            }
        }

        e.preventDefault();
        if (!isDrawing || !currentAction || !startPointRef.current) return;

        const coords = getCoordinates(e);

        // Clear existing hold timer
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
        }

        // Determine if we should draw a straight line
        const shouldBeStraight = isShiftPressed || isStraightened;

        let newPoints = [...currentAction.points, coords];

        if (shouldBeStraight) {
            // Replace all points with just start and end
            newPoints = [startPointRef.current, coords];
        } else {
            // Start hold timer for auto-straighten
            holdTimerRef.current = setTimeout(() => {
                setIsStraightened(true);
                // Trigger a re-render with straightened line
                // We need to access the LATEST coords here, but we can't easily in setTimeout
                // So we'll rely on the state update to trigger the effect
            }, 600); // 600ms hold to straighten
        }

        setCurrentAction({
            ...currentAction,
            points: newPoints
        });
    };

    const stopDrawing = () => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
        }

        if (!isDrawing || !currentAction || currentAction.points.length < 2) {
            setIsDrawing(false);
            setCurrentAction(null);
            setIsStraightened(false);
            return;
        }

        // Add to history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentAction);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        setIsDrawing(false);
        setCurrentAction(null);
        setIsStraightened(false);
    };

    const undo = () => {
        if (historyIndex >= 0) {
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
        }
    };

    const clear = () => {
        setHistory([]);
        setHistoryIndex(-1);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
            ctx.clearRect(0, 0, width, height);
        }
        // Clear from localStorage
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    };

    const save = () => {
        const canvas = canvasRef.current;
        if (!canvas || !onSave) return;

        const dataUrl = canvas.toDataURL("image/png");
        onSave(dataUrl);
    };

    const handleAddCustomColor = () => {
        if (customColors.length >= 5) {
            alert('최대 5개의 커스텀 색상만 추가할 수 있습니다.');
            return;
        }
        if (!customColors.includes(tempColor)) {
            setCustomColors([...customColors, tempColor]);
        }
        setPenColor(tempColor);
        setShowColorPicker(false);
    };

    const handleRemoveCustomColor = (colorToRemove: string) => {
        setCustomColors(customColors.filter(c => c !== colorToRemove));
    };

    const allColors = [...DEFAULT_COLORS, ...customColors];

    return (
        <div className="relative w-full h-full">
            {/* Toolbar - Absolute positioned to not affect layout */}
            {!readOnly && (
                <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col md:flex-row items-center gap-2 p-1.5 md:p-2 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 max-w-[95vw] overflow-x-auto">
                    {/* Mobile: Compact Horizontal Layout */}
                    <div className="flex items-center gap-1 md:gap-2 w-full md:w-auto overflow-x-auto">
                        {/* Tools */}
                        <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                            <Button
                                size="sm"
                                variant={tool === "pen" ? "default" : "ghost"}
                                onClick={() => setTool("pen")}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="펜"
                            >
                                <Pencil className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant={tool === "highlighter" ? "default" : "ghost"}
                                onClick={() => setTool("highlighter")}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="형광펜"
                            >
                                <Highlighter className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant={tool === "eraser" ? "default" : "ghost"}
                                onClick={() => setTool("eraser")}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="지우개"
                            >
                                <Eraser className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                        </div>

                        <div className="w-px h-5 md:h-6 bg-white/10 shrink-0" />

                        {/* Colors */}
                        {(tool === "pen" || tool === "highlighter") && (
                            <div className="relative flex items-center gap-0.5 md:gap-1 shrink-0">
                                {allColors.map((color, index) => (
                                    <div key={color} className="relative group">
                                        <button
                                            onClick={() => setPenColor(color)}
                                            className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all ${penColor === color ? "border-white scale-110" : "border-white/30 hover:border-white/60"
                                                }`}
                                            style={{ backgroundColor: color }}
                                            title={index >= DEFAULT_COLORS.length ? "커스텀 색상 (길게 눌러 삭제)" : ""}
                                            onContextMenu={(e) => {
                                                if (index >= DEFAULT_COLORS.length) {
                                                    e.preventDefault();
                                                    handleRemoveCustomColor(color);
                                                }
                                            }}
                                            onTouchStart={(e) => {
                                                if (index >= DEFAULT_COLORS.length) {
                                                    const timer = setTimeout(() => {
                                                        if (confirm('이 색상을 삭제하시겠습니까?')) {
                                                            handleRemoveCustomColor(color);
                                                        }
                                                    }, 500);
                                                    e.currentTarget.addEventListener('touchend', () => clearTimeout(timer), { once: true });
                                                }
                                            }}
                                        />
                                        {index >= DEFAULT_COLORS.length && (
                                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[8px] flex items-center justify-center">
                                                ×
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {customColors.length < 5 && (
                                    <div className="relative" ref={colorPickerRef}>
                                        <button
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-dashed border-white/30 hover:border-white/60 flex items-center justify-center transition-all shrink-0"
                                            title="커스텀 색상 추가"
                                        >
                                            <Plus className="w-2.5 h-2.5 md:w-3 md:h-3 text-white/60" />
                                        </button>
                                        {showColorPicker && (
                                            <div className="absolute top-8 left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 z-50 bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg p-2 md:p-3 shadow-xl animate-in fade-in slide-in-from-top-2">
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        type="color"
                                                        value={tempColor}
                                                        onChange={(e) => setTempColor(e.target.value)}
                                                        className="w-20 h-8 md:w-24 md:h-8 rounded cursor-pointer"
                                                    />
                                                    <Button
                                                        onClick={handleAddCustomColor}
                                                        size="sm"
                                                        className="w-full h-7 text-xs"
                                                    >
                                                        <Check className="w-3 h-3 mr-1" />
                                                        저장
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="w-px h-5 md:h-6 bg-white/10 shrink-0" />

                        {/* Width */}
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                            <span className="text-[10px] md:text-xs text-gray-400 hidden md:inline">굵기</span>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={penWidth}
                                onChange={(e) => setPenWidth(Number(e.target.value))}
                                className="w-12 md:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-[10px] text-gray-400 w-3 md:hidden">{penWidth}</span>
                        </div>

                        <div className="w-px h-5 md:h-6 bg-white/10 shrink-0" />

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={undo}
                                disabled={historyIndex < 0}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="실행취소"
                            >
                                <Undo className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="다시실행"
                            >
                                <Redo className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clear}
                                className="w-7 h-7 md:w-8 md:h-8 p-0"
                                title="전체삭제"
                            >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <div className="absolute inset-0 z-10">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className={readOnly ? "pointer-events-none" : "cursor-crosshair"}
                    style={{
                        width: '100%',
                        height: '100%',
                        touchAction: readOnly ? 'auto' : 'none'
                    }}
                />
            </div>
        </div>
    );
}
