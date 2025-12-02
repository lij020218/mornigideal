"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Eraser, Trash2, Undo, Redo, Highlighter } from "lucide-react";

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

    // Load saved drawing when storageKey changes
    useEffect(() => {
        if (!storageKey) return;

        // Reset state for new key
        setHistory([]);
        setHistoryIndex(-1);
        setCurrentAction(null);

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

    return (
        <div className="relative w-full h-full">
            {/* Toolbar - Absolute positioned to not affect layout */}
            {!readOnly && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2">
                    {/* Tools */}
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant={tool === "pen" ? "default" : "ghost"}
                            onClick={() => setTool("pen")}
                            className="w-8 h-8 p-0"
                            title="펜"
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant={tool === "highlighter" ? "default" : "ghost"}
                            onClick={() => setTool("highlighter")}
                            className="w-8 h-8 p-0"
                            title="형광펜"
                        >
                            <Highlighter className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant={tool === "eraser" ? "default" : "ghost"}
                            onClick={() => setTool("eraser")}
                            className="w-8 h-8 p-0"
                            title="지우개"
                        >
                            <Eraser className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    {/* Colors */}
                    {(tool === "pen" || tool === "highlighter") && (
                        <div className="flex items-center gap-1">
                            {["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#000000"].map(color => (
                                <button
                                    key={color}
                                    onClick={() => setPenColor(color)}
                                    className={`w-6 h-6 rounded-full border-2 ${penColor === color ? "border-white" : "border-transparent"
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    )}

                    <div className="w-px h-6 bg-white/10" />

                    {/* Width */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">굵기</span>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={penWidth}
                            onChange={(e) => setPenWidth(Number(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="w-px h-6 bg-white/10 ml-auto" />

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={undo}
                            disabled={historyIndex < 0}
                            className="w-8 h-8 p-0"
                        >
                            <Undo className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="w-8 h-8 p-0"
                        >
                            <Redo className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={clear}
                            className="w-8 h-8 p-0"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
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
                    className={readOnly ? "touch-none pointer-events-none" : "touch-none cursor-crosshair"}
                    style={{
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>
        </div>
    );
}
