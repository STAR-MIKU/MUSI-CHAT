import { useState, useRef, useEffect } from 'react'
import Peer from 'simple-peer'
import './App.css'

function App() {
  // 状态管理
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [peerId, setPeerId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isCreatingOffer, setIsCreatingOffer] = useState(false)
  const [offer, setOffer] = useState('')
  const [answer, setAnswer] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [currentTab, setCurrentTab] = useState('chat')
  const [nickname, setNickname] = useState('User' + Math.floor(Math.random() * 1000))
  
  // 引用
  const peerRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const offerTextareaRef = useRef(null)
  const answerTextareaRef = useRef(null)
  
  // 获取本地视频流
  useEffect(() => {
    const getLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing media devices:', error)
      }
    }
    
    getLocalStream()
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [localStream])
  
  // 创建P2P连接
  const createConnection = (isInitiator = false) => {
    // 销毁现有连接
    if (peerRef.current) {
      peerRef.current.destroy()
    }
    
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream: localStream
    })
    
    peerRef.current = peer
    
    peer.on('signal', data => {
      if (isInitiator) {
        setOffer(JSON.stringify(data))
      } else {
        setAnswer(JSON.stringify(data))
      }
    })
    
    peer.on('connect', () => {
      setIsConnected(true)
      setIsCreatingOffer(false)
      addMessage('系统消息: 连接成功!', 'system')
    })
    
    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString())
        if (message.type === 'file') {
          handleFileData(message)
        } else {
          addMessage(message.text, message.sender)
        }
      } catch (e) {
        addMessage(data.toString(), 'peer')
      }
    })
    
    peer.on('stream', stream => {
      setRemoteStream(stream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
    })
    
    peer.on('error', err => {
      console.error('Peer error:', err)
      addMessage(`系统消息: 连接错误 - ${err.message}`, 'system')
    })
    
    peer.on('close', () => {
      setIsConnected(false)
      addMessage('系统消息: 连接已关闭', 'system')
    })
  }
  
  // 创建连接请求
  const createOffer = () => {
    setIsCreatingOffer(true)
    createConnection(true)
  }
  
  // 接受连接请求
  const acceptOffer = () => {
    if (!peerRef.current && offer) {
      createConnection(false)
      peerRef.current.signal(JSON.parse(offer))
    }
  }
  
  // 发送回复
  const sendAnswer = () => {
    if (peerId && answer) {
      // 在实际应用中，这里会通过服务器发送answer
      // 由于没有服务器，用户需要手动复制answer给对方
      setIsCreatingOffer(false)
    }
  }
  
  // 连接到远程对等方
  const connectToPeer = () => {
    if (peerRef.current && peerId) {
      try {
        peerRef.current.signal(JSON.parse(peerId))
      } catch (e) {
        console.error('Invalid peer ID:', e)
        addMessage('系统消息: 无效的连接信息', 'system')
      }
    }
  }
  
  // 发送消息
  const sendMessage = () => {
    if (messageInput.trim() && peerRef.current && isConnected) {
      const message = {
        text: messageInput.trim(),
        sender: nickname,
        type: 'message'
      }
      peerRef.current.send(JSON.stringify(message))
      addMessage(message.text, 'me')
      setMessageInput('')
    }
  }
  
  // 添加消息到聊天记录
  const addMessage = (text, sender) => {
    setMessages(prev => [...prev, { text, sender, timestamp: new Date() }])
  }
  
  // 处理文件数据
  const handleFileData = (fileData) => {
    const blob = new Blob([Uint8Array.from(atob(fileData.content), c => c.charCodeAt(0))], { type: fileData.mimeType })
    const url = URL.createObjectURL(blob)
    const fileName = fileData.name
    
    addMessage(`收到文件: <a href="${url}" target="_blank">${fileName}</a>`, 'peer')
  }
  
  // 发送文件
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && peerRef.current && isConnected) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Content = btoa(String.fromCharCode.apply(null, new Uint8Array(e.target.result)))
        const fileData = {
          name: file.name,
          mimeType: file.type,
          content: base64Content,
          size: file.size,
          type: 'file'
        }
        
        peerRef.current.send(JSON.stringify(fileData))
        addMessage(`发送文件: ${file.name}`, 'me')
      }
      reader.readAsArrayBuffer(file)
    }
    event.target.value = ''
  }
  
  // 断开连接
  const disconnect = () => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
      setIsConnected(false)
      setOffer('')
      setAnswer('')
      setPeerId('')
    }
  }
  
  // 复制到剪贴板
  const copyToClipboard = (text, elementId) => {
    navigator.clipboard.writeText(text).then(() => {
      const element = document.getElementById(elementId)
      const originalText = element.textContent
      element.textContent = '已复制!'
      setTimeout(() => {
        element.textContent = originalText
      }, 2000)
    })
  }
  
  return (
    <div className="app-container">
      <header>
        <h1>MUSICHAT - 局域网即时通讯</h1>
        <div className="status-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '已连接' : '未连接'}
          </span>
          <input 
            type="text" 
            placeholder="输入你的昵称" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)}
            className="nickname-input"
          />
        </div>
      </header>
      
      <div className="tabs">
        <button className={`tab ${currentTab === 'chat' ? 'active' : ''}`} onClick={() => setCurrentTab('chat')}>聊天</button>
        <button className={`tab ${currentTab === 'video' ? 'active' : ''}`} onClick={() => setCurrentTab('video')}>视频通话</button>
        <button className={`tab ${currentTab === 'connect' ? 'active' : ''}`} onClick={() => setCurrentTab('connect')}>连接设置</button>
      </div>
      
      <main>
        {currentTab === 'chat' && (
          <div className="chat-container">
            <div className="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.sender !== 'system' && <span className="sender">{msg.sender}: </span>}
                  <span dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="file-upload"
              />
              <input 
                type="text" 
                value={messageInput} 
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="输入消息..."
                className="message-input"
              />
              <button onClick={sendMessage} disabled={!isConnected}>发送</button>
            </div>
          </div>
        )}
        
        {currentTab === 'video' && (
          <div className="video-container">
            <div className="video-wrapper">
              <div className="video-box local">
                <h3>本地视频</h3>
                <video ref={localVideoRef} autoPlay muted></video>
              </div>
              <div className="video-box remote">
                <h3>远程视频</h3>
                {remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay></video>
                ) : (
                  <div className="no-stream">等待对方加入视频...</div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {currentTab === 'connect' && (
          <div className="connect-container">
            <div className="connection-section">
              <h3>创建连接</h3>
              <button onClick={createOffer} disabled={isConnected || isCreatingOffer}>
                生成连接邀请
              </button>
              
              {isCreatingOffer && (
                <div className="offer-section">
                  <p>请将下方邀请码发送给对方:</p>
                  <textarea 
                    ref={offerTextareaRef}
                    value={offer} 
                    readOnly
                    rows="6"
                  />
                  <button 
                    id="copy-offer"
                    onClick={() => copyToClipboard(offer, 'copy-offer')}
                    disabled={!offer}
                  >
                    复制邀请码
                  </button>
                </div>
              )}
            </div>
            
            <div className="connection-section">
              <h3>加入连接</h3>
              <textarea 
                value={peerId} 
                onChange={(e) => setPeerId(e.target.value)}
                placeholder="粘贴对方的邀请码或回复码"
                rows="6"
              />
              <button onClick={connectToPeer} disabled={isConnected}>连接</button>
            </div>
            
            {answer && (
              <div className="connection-section">
                <h3>你的回复码</h3>
                <p>请将下方回复码发送给对方:</p>
                <textarea 
                  ref={answerTextareaRef}
                  value={answer} 
                  readOnly
                  rows="6"
                />
                <button 
                  id="copy-answer"
                  onClick={() => copyToClipboard(answer, 'copy-answer')}
                >
                  复制回复码
                </button>
              </div>
            )}
            
            {isConnected && (
              <button className="disconnect-btn" onClick={disconnect}>
                断开连接
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
