import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const TOOLS = {
  SELECT: 'select',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  TEXT: 'text',
}

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF8800',
  '#8800FF', '#0088FF',
]

function App() {
  const [elements, setElements] = useState([])
  const [currentTool, setCurrentTool] = useState(TOOLS.LINE)
  const [currentColor, setCurrentColor] = useState(COLORS[0])
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState(null)
  const [currentPoint, setCurrentPoint] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [textInput, setTextInput] = useState('')
  const [isAddingText, setIsAddingText] = useState(false)
  const [textPosition, setTextPosition] = useState(null)
  
  const canvasRef = useRef(null)
  const canvasWidth = 1200
  const canvasHeight = 800

  const saveToHistory = useCallback((newElements) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(JSON.parse(JSON.stringify(newElements)))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setElements(JSON.parse(JSON.stringify(history[historyIndex - 1])))
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setElements(JSON.parse(JSON.stringify(history[historyIndex + 1])))
    }
  }, [history, historyIndex])

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = (e) => {
    const pos = getMousePos(e)
    
    if (currentTool === TOOLS.SELECT) {
      const clickedElement = elements.findLast(el => {
        if (el.type === 'line') {
          const distance = pointToLineDistance(pos, el.start, el.end)
          return distance < 5
        } else if (el.type === 'rectangle') {
          return pos.x >= Math.min(el.x, el.x + el.width) &&
                 pos.x <= Math.max(el.x, el.x + el.width) &&
                 pos.y >= Math.min(el.y, el.y + el.height) &&
                 pos.y <= Math.max(el.y, el.y + el.height)
        } else if (el.type === 'text') {
          const textWidth = el.text.length * 8
          return pos.x >= el.x && pos.x <= el.x + textWidth &&
                 pos.y >= el.y - 14 && pos.y <= el.y
        }
        return false
      })
      
      if (clickedElement) {
        setSelectedElement(clickedElement.id)
        setIsDrawing(true)
        setStartPoint(pos)
      } else {
        setSelectedElement(null)
      }
    } else if (currentTool === TOOLS.TEXT) {
      setIsAddingText(true)
      setTextPosition(pos)
    } else {
      setIsDrawing(true)
      setStartPoint(pos)
      setCurrentPoint(pos)
    }
  }

  const pointToLineDistance = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1

    if (lenSq !== 0) param = dot / lenSq

    let xx, yy

    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleMouseMove = (e) => {
    if (!isDrawing) return
    
    const pos = getMousePos(e)
    
    if (currentTool === TOOLS.SELECT && selectedElement !== null) {
      const dx = pos.x - startPoint.x
      const dy = pos.y - startPoint.y
      
      setElements(elements.map(el => {
        if (el.id === selectedElement) {
          if (el.type === 'line') {
            return {
              ...el,
              start: { x: el.start.x + dx, y: el.start.y + dy },
              end: { x: el.end.x + dx, y: el.end.y + dy },
            }
          } else if (el.type === 'rectangle') {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
            }
          } else if (el.type === 'text') {
            return {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
            }
          }
        }
        return el
      }))
      setStartPoint(pos)
    } else {
      setCurrentPoint(pos)
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing) return
    
    if (currentTool === TOOLS.SELECT && selectedElement !== null) {
      saveToHistory(elements)
    } else if (startPoint && currentPoint) {
      const newElement = {
        id: Date.now(),
        color: currentColor,
      }

      if (currentTool === TOOLS.LINE) {
        newElement.type = 'line'
        newElement.start = { ...startPoint }
        newElement.end = { ...currentPoint }
      } else if (currentTool === TOOLS.RECTANGLE) {
        newElement.type = 'rectangle'
        newElement.x = startPoint.x
        newElement.y = startPoint.y
        newElement.width = currentPoint.x - startPoint.x
        newElement.height = currentPoint.y - startPoint.y
      }

      if (currentTool !== TOOLS.SELECT && currentTool !== TOOLS.TEXT) {
        const newElements = [...elements, newElement]
        setElements(newElements)
        saveToHistory(newElements)
      }
    }

    setIsDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
  }

  const handleAddText = () => {
    if (textInput.trim() && textPosition) {
      const newElement = {
        id: Date.now(),
        type: 'text',
        text: textInput,
        x: textPosition.x,
        y: textPosition.y,
        color: currentColor,
      }
      const newElements = [...elements, newElement]
      setElements(newElements)
      saveToHistory(newElements)
    }
    setIsAddingText(false)
    setTextInput('')
    setTextPosition(null)
  }

  const deleteSelected = useCallback(() => {
    if (selectedElement !== null) {
      const newElements = elements.filter(el => el.id !== selectedElement)
      setElements(newElements)
      setSelectedElement(null)
      saveToHistory(newElements)
    }
  }, [elements, selectedElement, saveToHistory])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT') {
          deleteSelected()
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          undo()
        } else if (e.key === 'y') {
          e.preventDefault()
          redo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected, undo, redo])

  const renderElement = (el) => {
    const isSelected = el.id === selectedElement
    const strokeWidth = isSelected ? 3 : 2

    if (el.type === 'line') {
      return (
        <line
          key={el.id}
          x1={el.start.x}
          y1={el.start.y}
          x2={el.end.x}
          y2={el.end.y}
          stroke={el.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )
    } else if (el.type === 'rectangle') {
      return (
        <rect
          key={el.id}
          x={Math.min(el.x, el.x + el.width)}
          y={Math.min(el.y, el.y + el.height)}
          width={Math.abs(el.width)}
          height={Math.abs(el.height)}
          fill="transparent"
          stroke={el.color}
          strokeWidth={strokeWidth}
        />
      )
    } else if (el.type === 'text') {
      return (
        <text
          key={el.id}
          x={el.x}
          y={el.y}
          fill={el.color}
          fontSize="16"
          fontFamily="Arial"
        >
          {el.text}
        </text>
      )
    }
    return null
  }

  const renderPreview = () => {
    if (!isDrawing || !startPoint || !currentPoint || currentTool === TOOLS.SELECT || currentTool === TOOLS.TEXT) {
      return null
    }

    if (currentTool === TOOLS.LINE) {
      return (
        <line
          x1={startPoint.x}
          y1={startPoint.y}
          x2={currentPoint.x}
          y2={currentPoint.y}
          stroke={currentColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="5,5"
        />
      )
    } else if (currentTool === TOOLS.RECTANGLE) {
      return (
        <rect
          x={Math.min(startPoint.x, currentPoint.x)}
          y={Math.min(startPoint.y, currentPoint.y)}
          width={Math.abs(currentPoint.x - startPoint.x)}
          height={Math.abs(currentPoint.y - startPoint.y)}
          fill="transparent"
          stroke={currentColor}
          strokeWidth={2}
          strokeDasharray="5,5"
        />
      )
    }
    return null
  }

  const clearCanvas = () => {
    const newElements = []
    setElements(newElements)
    setSelectedElement(null)
    saveToHistory(newElements)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>简易作图工具</h1>
        <p>随手记录，简单梳理，快速画草图</p>
      </header>

      <div className="toolbar">
        <div className="tool-section">
          <span className="section-title">工具</span>
          <div className="tools">
            <button
              className={`tool-btn ${currentTool === TOOLS.SELECT ? 'active' : ''}`}
              onClick={() => setCurrentTool(TOOLS.SELECT)}
              title="选择移动 (V)"
            >
              ✋ 选择
            </button>
            <button
              className={`tool-btn ${currentTool === TOOLS.LINE ? 'active' : ''}`}
              onClick={() => setCurrentTool(TOOLS.LINE)}
              title="线条 (L)"
            >
              📏 线条
            </button>
            <button
              className={`tool-btn ${currentTool === TOOLS.RECTANGLE ? 'active' : ''}`}
              onClick={() => setCurrentTool(TOOLS.RECTANGLE)}
              title="矩形 (R)"
            >
              ⬜ 矩形
            </button>
            <button
              className={`tool-btn ${currentTool === TOOLS.TEXT ? 'active' : ''}`}
              onClick={() => setCurrentTool(TOOLS.TEXT)}
              title="文字 (T)"
            >
              📝 文字
            </button>
          </div>
        </div>

        <div className="tool-section">
          <span className="section-title">颜色</span>
          <div className="colors">
            {COLORS.map(color => (
              <button
                key={color}
                className={`color-btn ${currentColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
                title={color}
              />
            ))}
          </div>
        </div>

        <div className="tool-section">
          <span className="section-title">操作</span>
          <div className="actions">
            <button
              className="action-btn"
              onClick={undo}
              disabled={historyIndex <= 0}
              title="撤销 (Ctrl+Z)"
            >
              ↶ 撤销
            </button>
            <button
              className="action-btn"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="重做 (Ctrl+Y)"
            >
              ↷ 重做
            </button>
            <button
              className="action-btn danger"
              onClick={deleteSelected}
              disabled={selectedElement === null}
              title="删除选中 (Delete)"
            >
              🗑️ 删除
            </button>
            <button
              className="action-btn danger"
              onClick={clearCanvas}
              title="清空画布"
            >
              🚫 清空
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <svg
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="white" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {elements.map(renderElement)}
          {renderPreview()}
        </svg>

        {isAddingText && (
          <div 
            className="text-input-modal"
            style={{
              position: 'absolute',
              left: textPosition?.x,
              top: textPosition?.y,
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="输入文字..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText()
                if (e.key === 'Escape') {
                  setIsAddingText(false)
                  setTextInput('')
                  setTextPosition(null)
                }
              }}
            />
            <div className="text-input-buttons">
              <button onClick={handleAddText}>确定</button>
              <button onClick={() => {
                setIsAddingText(false)
                setTextInput('')
                setTextPosition(null)
              }}>取消</button>
            </div>
          </div>
        )}
      </div>

      <div className="status-bar">
        <span>当前工具: {currentTool}</span>
        <span>元素数量: {elements.length}</span>
        {selectedElement !== null && <span>已选中元素</span>}
      </div>
    </div>
  )
}

export default App
