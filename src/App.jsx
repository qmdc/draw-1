import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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

const STORAGE_KEYS = {
  FILES: 'sketch_files',
  CURRENT_FILE_ID: 'sketch_current_file_id',
  SHARED: 'sketch_shared',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function generateShareId() {
  return Math.random().toString(36).substr(2, 8)
}

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function loadFromLocalStorage(key, defaultValue) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
    return defaultValue
  }
}

function createNewFile(name = '未命名画布') {
  return {
    id: generateId(),
    name,
    elements: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function JsonTreeViewer({ json, initialExpanded = true }) {
  const [expandedKeys, setExpandedKeys] = useState(new Set())
  
  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }
  
  const isExpanded = (key) => {
    if (initialExpanded && expandedKeys.size === 0) return true
    return expandedKeys.has(key) || (initialExpanded && expandedKeys.size === 0)
  }
  
  const renderValue = (value, keyPath = '') => {
    if (value === null) {
      return <span className="json-null">null</span>
    }
    
    if (typeof value === 'boolean') {
      return <span className="json-boolean">{String(value)}</span>
    }
    
    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>
    }
    
    if (typeof value === 'string') {
      return <span className="json-string">"{value}"</span>
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="json-bracket">[]</span>
      }
      
      const isExp = isExpanded(keyPath)
      
      return (
        <span>
          <span 
            className="json-toggle"
            onClick={() => toggleExpand(keyPath)}
          >
            {isExp ? '▼' : '▶'}
          </span>
          <span className="json-bracket">[</span>
          {isExp && (
            <span className="json-children">
              {value.map((item, index) => (
                <span key={index} className="json-item">
                  <span className="json-index">{index}</span>
                  <span className="json-colon">: </span>
                  {renderValue(item, `${keyPath}[${index}]`)}
                  {index < value.length - 1 && <span className="json-comma">,</span>}
                </span>
              ))}
            </span>
          )}
          {!isExp && <span className="json-ellipsis">...</span>}
          <span className="json-bracket">]</span>
          {!isExp && <span className="json-count"> ({value.length} items)</span>}
        </span>
      )
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) {
        return <span className="json-brace">{`{}`}</span>
      }
      
      const isExp = isExpanded(keyPath)
      
      return (
        <span>
          <span 
            className="json-toggle"
            onClick={() => toggleExpand(keyPath)}
          >
            {isExp ? '▼' : '▶'}
          </span>
          <span className="json-brace">{`{`}</span>
          {isExp && (
            <span className="json-children">
              {keys.map((k, index) => (
                <span key={k} className="json-item">
                  <span className="json-key">"{k}"</span>
                  <span className="json-colon">: </span>
                  {renderValue(value[k], `${keyPath}.${k}`)}
                  {index < keys.length - 1 && <span className="json-comma">,</span>}
                </span>
              ))}
            </span>
          )}
          {!isExp && <span className="json-ellipsis">...</span>}
          <span className="json-brace">{`}`}</span>
          {!isExp && <span className="json-count"> ({keys.length} keys)</span>}
        </span>
      )
    }
    
    return <span>{String(value)}</span>
  }
  
  return (
    <div className="json-tree-viewer">
      {renderValue(json, '$')}
    </div>
  )
}

function App() {
  const [files, setFiles] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.FILES, null)
    if (saved && saved.length > 0) return saved
    const defaultFile = createNewFile('我的第一个草图')
    return [defaultFile]
  })
  
  const [currentFileId, setCurrentFileId] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.CURRENT_FILE_ID, null)
    if (saved) {
      const exists = files.find(f => f.id === saved)
      if (exists) return saved
    }
    return files[0]?.id || null
  })
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [editingFileId, setEditingFileId] = useState(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [isViewMode, setIsViewMode] = useState(false)
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownFileName, setMarkdownFileName] = useState('')
  
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    const view = params.get('view')
    
    if (shareId) {
      const shared = loadFromLocalStorage(STORAGE_KEYS.SHARED, {})
      const sharedData = shared[shareId]
      if (sharedData) {
        setIsViewMode(true)
        setElements(sharedData.elements || [])
        if (sharedData.name) {
          document.title = `查看: ${sharedData.name}`
        }
      }
    } else if (view === 'markdown') {
      setIsViewMode(true)
      setShowMarkdownEditor(true)
      const content = localStorage.getItem('shared_markdown_content') || ''
      const name = localStorage.getItem('shared_markdown_name') || '未命名文档'
      setMarkdownContent(content)
      setMarkdownFileName(name)
      document.title = `查看: ${name}`
    }
  }, [])

  useEffect(() => {
    if (!isViewMode && currentFileId) {
      const currentFile = files.find(f => f.id === currentFileId)
      if (currentFile) {
        setElements(currentFile.elements || [])
        setHistory([JSON.parse(JSON.stringify(currentFile.elements || []))])
        setHistoryIndex(0)
      }
    }
  }, [currentFileId, files, isViewMode])

  useEffect(() => {
    if (!isViewMode) {
      saveToLocalStorage(STORAGE_KEYS.FILES, files)
    }
  }, [files, isViewMode])

  useEffect(() => {
    if (!isViewMode && currentFileId) {
      saveToLocalStorage(STORAGE_KEYS.CURRENT_FILE_ID, currentFileId)
    }
  }, [currentFileId, isViewMode])

  const saveCurrentFile = useCallback((newElements) => {
    if (isViewMode) return
    setFiles(prev => prev.map(f => {
      if (f.id === currentFileId) {
        return {
          ...f,
          elements: newElements,
          updatedAt: Date.now(),
        }
      }
      return f
    }))
  }, [currentFileId, isViewMode])

  const saveToHistory = useCallback((newElements) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(JSON.parse(JSON.stringify(newElements)))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    saveCurrentFile(newElements)
  }, [history, historyIndex, saveCurrentFile])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const newElements = JSON.parse(JSON.stringify(history[newIndex]))
      setElements(newElements)
      saveCurrentFile(newElements)
    }
  }, [history, historyIndex, saveCurrentFile])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const newElements = JSON.parse(JSON.stringify(history[newIndex]))
      setElements(newElements)
      saveCurrentFile(newElements)
    }
  }, [history, historyIndex, saveCurrentFile])

  const createNewFileHandler = () => {
    const newFile = createNewFile(`画布 ${files.length + 1}`)
    setFiles(prev => [...prev, newFile])
    setCurrentFileId(newFile.id)
  }

  const deleteFile = (fileId, e) => {
    e.stopPropagation()
    if (files.length <= 1) {
      alert('至少需要保留一个画布！')
      return
    }
    
    if (confirm('确定要删除这个画布吗？此操作不可撤销。')) {
      const newFiles = files.filter(f => f.id !== fileId)
      setFiles(newFiles)
      
      if (currentFileId === fileId) {
        setCurrentFileId(newFiles[0].id)
      }
    }
  }

  const renameFile = (fileId) => {
    const file = files.find(f => f.id === fileId)
    if (file) {
      setEditingFileId(fileId)
      setEditingFileName(file.name)
    }
  }

  const saveRename = () => {
    if (editingFileId && editingFileName.trim()) {
      setFiles(prev => prev.map(f => {
        if (f.id === editingFileId) {
          return { ...f, name: editingFileName.trim(), updatedAt: Date.now() }
        }
        return f
      }))
    }
    setEditingFileId(null)
    setEditingFileName('')
  }

  const exportToImage = async () => {
    const svgElement = canvasRef.current
    if (!svgElement) return
    
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      img.onload = () => {
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        const pngUrl = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        const currentFile = files.find(f => f.id === currentFileId)
        link.download = `${currentFile?.name || 'sketch'}.png`
        link.href = pngUrl
        link.click()
        
        URL.revokeObjectURL(url)
      }
      
      img.src = url
      setIsExportModalOpen(false)
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败，请重试')
    }
  }

  const generateShareLink = () => {
    const shareId = generateShareId()
    const currentFile = files.find(f => f.id === currentFileId)
    
    if (!currentFile) return
    
    const shared = loadFromLocalStorage(STORAGE_KEYS.SHARED, {})
    shared[shareId] = {
      name: currentFile.name,
      elements: currentFile.elements,
      createdAt: Date.now(),
    }
    saveToLocalStorage(STORAGE_KEYS.SHARED, shared)
    
    const baseUrl = window.location.origin + window.location.pathname
    const link = `${baseUrl}?share=${shareId}`
    setShareLink(link)
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('链接已复制到剪贴板！')
    }).catch(() => {
      alert('复制失败，请手动复制')
    })
  }

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = (e) => {
    if (isViewMode) return
    
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
    if (isViewMode || !isDrawing) return
    
    const pos = getMousePos(e)
    
    if (currentTool === TOOLS.SELECT && selectedElement !== null) {
      const dx = pos.x - startPoint.x
      const dy = pos.y - startPoint.y
      
      const newElements = elements.map(el => {
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
      })
      
      setElements(newElements)
      setStartPoint(pos)
    } else {
      setCurrentPoint(pos)
    }
  }

  const handleMouseUp = () => {
    if (isViewMode || !isDrawing) return
    
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
    if (isViewMode) return
    
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
  }, [deleteSelected, undo, redo, isViewMode])

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
    if (isViewMode) return
    if (confirm('确定要清空画布吗？')) {
      const newElements = []
      setElements(newElements)
      setSelectedElement(null)
      saveToHistory(newElements)
    }
  }

  const currentFile = useMemo(() => {
    return files.find(f => f.id === currentFileId)
  }, [files, currentFileId])

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  if (isViewMode && showMarkdownEditor) {
    return (
      <div className="app markdown-view-mode">
        <header className="header">
          <h1>{markdownFileName}</h1>
          <p>只读模式 - 分享的文档</p>
        </header>
        
        <div className="markdown-container">
          <div className="markdown-preview" id="markdown-preview">
            <div dangerouslySetInnerHTML={{ __html: parseMarkdown(markdownContent) }} />
          </div>
        </div>
        
        <div className="status-bar">
          <span>查看模式</span>
          <span>文档: {markdownFileName}</span>
        </div>
      </div>
    )
  }

  if (isViewMode) {
    return (
      <div className="app view-mode">
        <header className="header">
          <h1>{currentFile?.name || '查看草图'}</h1>
          <p>只读模式 - 分享的草图</p>
        </header>

        <div className="canvas-container">
          <svg
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="canvas"
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="white" />
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {elements.map(renderElement)}
          </svg>
        </div>

        <div className="status-bar">
          <span>查看模式</span>
          <span>元素数量: {elements.length}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <button 
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? '◀ 隐藏' : '▶ 显示'}
        </button>
        <div className="header-title">
          <h1>{currentFile?.name || '简易作图工具'}</h1>
          <p>随手记录，简单梳理，快速画草图</p>
        </div>
        <div className="header-actions">
          <button
            className="action-btn"
            onClick={() => setShowMarkdownEditor(true)}
            title="Markdown 编辑器"
          >
            📝 Markdown
          </button>
          <button 
            className="action-btn"
            onClick={() => setIsExportModalOpen(true)}
          >
            📷 导出图片
          </button>
          <button 
            className="action-btn"
            onClick={() => {
              generateShareLink()
              setIsShareModalOpen(true)
            }}
          >
            🔗 分享
          </button>
        </div>
      </header>

      <div className="main-content">
        {isSidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <h3>📁 我的画布</h3>
              <button 
                className="new-file-btn"
                onClick={createNewFileHandler}
                title="新建画布"
              >
                + 新建
              </button>
            </div>
            <div className="file-list">
              {files.map(file => (
                <div 
                  key={file.id}
                  className={`file-item ${file.id === currentFileId ? 'active' : ''}`}
                  onClick={() => !editingFileId && setCurrentFileId(file.id)}
                >
                  {editingFileId === file.id ? (
                    <div className="file-edit">
                      <input
                        type="text"
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename()
                          if (e.key === 'Escape') {
                            setEditingFileId(null)
                            setEditingFileName('')
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button 
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          saveRename()
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="file-info">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{file.name}</span>
                      </div>
                      <div className="file-meta">
                        <span className="file-date">
                          {formatDate(file.updatedAt)}
                        </span>
                        <span className="file-elements">
                          {(file.elements?.length || 0)} 个元素
                        </span>
                      </div>
                    </>
                  )}
                  
                  {!editingFileId && (
                    <div className="file-actions">
                      <button 
                        className="file-action-btn"
                        onClick={(e) => renameFile(file.id)}
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button 
                        className="file-action-btn delete"
                        onClick={(e) => deleteFile(file.id, e)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="workspace">
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
        </div>
      </div>

      <div className="status-bar">
        <span>当前工具: {currentTool}</span>
        <span>元素数量: {elements.length}</span>
        {selectedElement !== null && <span>已选中元素</span>}
      </div>

      {isExportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导出图片</h3>
              <button 
                className="modal-close"
                onClick={() => setIsExportModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>将当前画布导出为 PNG 图片文件。</p>
              <div className="preview-box">
                <svg
                  width={300}
                  height={200}
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                  className="export-preview"
                >
                  <defs>
                    <pattern id="grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="white" />
                  <rect width="100%" height="100%" fill="url(#grid-small)" />
                  {elements.map(renderElement)}
                </svg>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setIsExportModalOpen(false)}
              >
                取消
              </button>
              <button 
                className="btn-primary"
                onClick={exportToImage}
              >
                下载 PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>分享画布</h3>
              <button 
                className="modal-close"
                onClick={() => setIsShareModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>生成分享链接，任何人都可以通过链接查看你的草图（无需登录）。</p>
              {shareLink ? (
                <div className="share-link-box">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="share-link-input"
                  />
                  <button 
                    className="btn-primary copy-btn"
                    onClick={copyShareLink}
                  >
                    复制链接
                  </button>
                </div>
              ) : (
                <div className="share-info">
                  <p>点击下方按钮生成分享链接</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setIsShareModalOpen(false)}
              >
                关闭
              </button>
              {!shareLink && (
                <button 
                  className="btn-primary"
                  onClick={generateShareLink}
                >
                  生成链接
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showMarkdownEditor && (
        <MarkdownEditor 
          onClose={() => setShowMarkdownEditor(false)}
          initialContent={markdownContent}
          initialFileName={markdownFileName}
        />
      )}
    </div>
  )
}

function MarkdownEditor({ onClose, initialContent = '', initialFileName = '' }) {
  const [markdown, setMarkdown] = useState(initialContent)
  const [fileName, setFileName] = useState(initialFileName || `文档-${Date.now().toString(36)}`)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonParseResult, setJsonParseResult] = useState(null)
  const [jsonParseError, setJsonParseError] = useState('')
  const [showJsonTools, setShowJsonTools] = useState(false)
  
  const markedInstance = useMemo(() => {
    const { marked } = window
    if (marked) {
      marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
          if (window.hljs && lang) {
            try {
              return window.hljs.highlight(code, { language: lang }).value
            } catch (e) {}
          }
          return code
        }
      })
    }
    return marked
  }, [])

  const parseMarkdown = useCallback((content) => {
    if (markedInstance) {
      try {
        return markedInstance.parse(content)
      } catch (e) {
        console.error('Markdown parse error:', e)
        return `<pre>${content}</pre>`
      }
    }
    return `<pre>${content}</pre>`
  }, [markedInstance])

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      setJsonParseResult(parsed)
      setJsonParseError('')
      setMarkdown(prev => {
        const codeBlock = `\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`
        return prev + codeBlock
      })
    } catch (e) {
      setJsonParseError('JSON 格式错误: ' + e.message)
      setJsonParseResult(null)
    }
  }

  const handleBeautifyJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      const beautified = JSON.stringify(parsed, null, 2)
      setJsonInput(beautified)
      setJsonParseResult(parsed)
      setJsonParseError('')
    } catch (e) {
      setJsonParseError('JSON 格式错误: ' + e.message)
    }
  }

  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      const minified = JSON.stringify(parsed)
      setJsonInput(minified)
      setJsonParseResult(parsed)
      setJsonParseError('')
    } catch (e) {
      setJsonParseError('JSON 格式错误: ' + e.message)
    }
  }

  const handleInsertJsonTree = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      setJsonParseResult(parsed)
      setJsonParseError('')
      
      const treeMarkdown = `\n**JSON 树形结构:**\n\`\`\`json-tree\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`
      setMarkdown(prev => prev + treeMarkdown)
    } catch (e) {
      setJsonParseError('JSON 格式错误: ' + e.message)
      setJsonParseResult(null)
    }
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonInput).then(() => {
      alert('JSON 已复制到剪贴板！')
    })
  }

  const handleExportHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <style>
    body {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      color: #333;
      background: #fff;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; line-height: 1.4; }
    h1 { font-size: 2.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.5em; }
    p { margin: 1em 0; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.85em; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #dfe2e5; padding-left: 1em; margin: 1em 0; color: #6a737d; }
    ul, ol { padding-left: 2em; margin: 1em 0; }
    li { margin: 0.5em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; }
    th { background: #f6f8fa; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #dfe2e5; margin: 2em 0; }
    .json-tree-viewer { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.5; }
    .json-toggle { cursor: pointer; user-select: none; margin-right: 4px; }
    .json-key { color: #0550ae; }
    .json-string { color: #0a3069; }
    .json-number { color: #0550ae; }
    .json-boolean { color: #cf222e; }
    .json-null { color: #6e7781; }
    .json-bracket, .json-brace { color: #24292f; }
    .json-colon { color: #24292f; }
    .json-comma { color: #24292f; }
    .json-index { color: #0550ae; }
    .json-children { margin-left: 20px; }
    .json-item { display: block; }
    .json-count { color: #6e7781; font-size: 12px; margin-left: 4px; }
    .json-ellipsis { color: #6e7781; margin: 0 4px; }
  </style>
</head>
<body>
${parseMarkdown(markdown)}
</body>
</html>`
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = async () => {
    try {
      const previewElement = document.getElementById('markdown-preview')
      if (!previewElement || !window.html2canvas || !window.jspdf) {
        alert('导出功能需要的库未加载，请刷新页面后重试')
        return
      }
      
      const canvas = await window.html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        background: '#ffffff'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const { jsPDF } = window.jspdf
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = canvas.height * imgWidth / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save(`${fileName}.pdf`)
    } catch (error) {
      console.error('PDF export error:', error)
      alert('导出 PDF 失败: ' + error.message)
    }
  }

  const generateShareLink = () => {
    const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
    
    localStorage.setItem('shared_markdown_content', markdown)
    localStorage.setItem('shared_markdown_name', fileName)
    
    const baseUrl = window.location.origin + window.location.pathname
    const link = `${baseUrl}?view=markdown`
    setShareLink(link)
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('链接已复制到剪贴板！')
    }).catch(() => {
      alert('复制失败，请手动复制')
    })
  }

  const renderPreview = () => {
    const html = parseMarkdown(markdown)
    
    const jsonTreeRegex = /```json-tree\n([\s\S]*?)```/g
    const parts = []
    let lastIndex = 0
    let match
    
    while ((match = jsonTreeRegex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'html',
          content: html.slice(lastIndex, match.index)
        })
      }
      
      try {
        const jsonContent = match[1].trim()
        const jsonData = JSON.parse(jsonContent)
        parts.push({
          type: 'json-tree',
          content: jsonData
        })
      } catch (e) {
        parts.push({
          type: 'html',
          content: match[0]
        })
      }
      
      lastIndex = match.index + match[0].length
    }
    
    if (lastIndex < html.length) {
      parts.push({
        type: 'html',
        content: html.slice(lastIndex)
      })
    }
    
    return parts.map((part, index) => {
      if (part.type === 'json-tree') {
        return (
          <div key={index} className="json-tree-wrapper">
            <JsonTreeViewer json={part.content} initialExpanded={true} />
          </div>
        )
      }
      return (
        <div 
          key={index} 
          dangerouslySetInnerHTML={{ __html: part.content }}
        />
      )
    })
  }

  return (
    <div className="markdown-editor-overlay">
      <div className="markdown-editor">
        <header className="markdown-header">
          <div className="markdown-title">
            <h2>Markdown 编辑器</h2>
            <input
              type="text"
              className="file-name-input"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="文档名称"
            />
          </div>
          <div className="markdown-actions">
            <button
              className="action-btn"
              onClick={() => setShowJsonTools(!showJsonTools)}
              title="JSON 工具"
            >
              🔧 JSON 工具
            </button>
            <button
              className="action-btn"
              onClick={handleExportHTML}
              title="导出 HTML"
            >
              📄 导出 HTML
            </button>
            <button
              className="action-btn"
              onClick={handleExportPDF}
              title="导出 PDF"
            >
              📑 导出 PDF
            </button>
            <button
              className="action-btn"
              onClick={() => {
                generateShareLink()
                setIsShareModalOpen(true)
              }}
              title="分享文档"
            >
              🔗 分享
            </button>
            <button
              className="action-btn close-btn"
              onClick={onClose}
              title="关闭"
            >
              ✕ 关闭
            </button>
          </div>
        </header>
        
        <div className="markdown-main">
          {showJsonTools && (
            <div className="json-tools-panel">
              <div className="panel-header">
                <h4>🔧 JSON 工具</h4>
                <button 
                  className="close-panel-btn"
                  onClick={() => setShowJsonTools(false)}
                >
                  ✕
                </button>
              </div>
              <div className="json-tools-content">
                <div className="json-input-section">
                  <label>输入 JSON:</label>
                  <textarea
                    className="json-input"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"name": "张三", "age": 25, "hobbies": ["读书", "编程"]}'
                    rows={8}
                  />
                  <div className="json-tool-buttons">
                    <button 
                      className="tool-btn"
                      onClick={handleBeautifyJson}
                      title="格式化 JSON"
                    >
                      🎨 美化
                    </button>
                    <button 
                      className="tool-btn"
                      onClick={handleMinifyJson}
                      title="压缩 JSON"
                    >
                      📦 压缩
                    </button>
                    <button 
                      className="tool-btn"
                      onClick={handleCopyJson}
                      title="复制到剪贴板"
                    >
                      📋 复制
                    </button>
                    <button 
                      className="tool-btn primary"
                      onClick={handleFormatJson}
                      title="插入到文档"
                    >
                      📝 插入代码块
                    </button>
                    <button 
                      className="tool-btn primary"
                      onClick={handleInsertJsonTree}
                      title="插入树形结构"
                    >
                      🌳 插入树形
                    </button>
                  </div>
                  {jsonParseError && (
                    <div className="json-error">{jsonParseError}</div>
                  )}
                </div>
                
                {jsonParseResult && (
                  <div className="json-preview-section">
                    <label>树形预览:</label>
                    <div className="json-tree-preview">
                      <JsonTreeViewer json={jsonParseResult} initialExpanded={true} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="markdown-split">
            <div className="markdown-edit-pane">
              <div className="pane-header">
                <span className="pane-title">📝 编辑</span>
              </div>
              <textarea
                className="markdown-textarea"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder={`# 欢迎使用 Markdown 编辑器

## 常用语法

### 标题
# 一级标题
## 二级标题
### 三级标题

### 文本样式
**粗体**
*斜体*
~~删除线~~

### 列表
- 项目 1
- 项目 2
  - 子项目

1. 第一项
2. 第二项

### 代码
\`行内代码\`

\`\`\`javascript
const hello = 'world'
console.log(hello)
\`\`\`

### JSON 工具
使用顶部的 JSON 工具按钮，可以：
- 格式化/压缩 JSON
- 插入代码块
- 插入可折叠的树形结构

\`\`\`json-tree
{
  "name": "示例",
  "data": [1, 2, 3]
}
\`\`\`

### 其他
> 引用文本

[链接文字](https://example.com)

---

| 表头1 | 表头2 |
|-------|-------|
| 单元格 | 单元格 |
`}
              />
            </div>
            
            <div className="markdown-preview-pane">
              <div className="pane-header">
                <span className="pane-title">👁️ 预览</span>
              </div>
              <div className="markdown-preview" id="markdown-preview">
                {renderPreview()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isShareModalOpen && (
        <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>分享文档</h3>
              <button 
                className="modal-close"
                onClick={() => setIsShareModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>生成分享链接，任何人都可以通过链接查看你的文档（无需登录）。</p>
              {shareLink ? (
                <div className="share-link-box">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="share-link-input"
                  />
                  <button 
                    className="btn-primary copy-btn"
                    onClick={copyShareLink}
                  >
                    复制链接
                  </button>
                </div>
              ) : (
                <div className="share-info">
                  <p>点击下方按钮生成分享链接</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setIsShareModalOpen(false)}
              >
                关闭
              </button>
              {!shareLink && (
                <button 
                  className="btn-primary"
                  onClick={generateShareLink}
                >
                  生成链接
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function parseMarkdown(content) {
  const { marked } = window
  if (marked) {
    try {
      return marked.parse(content)
    } catch (e) {
      console.error('Markdown parse error:', e)
      return `<pre>${content}</pre>`
    }
  }
  return `<pre>${content}</pre>`
}

export default App
