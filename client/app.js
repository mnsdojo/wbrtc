/**
 * P2P Swift v4.0 - Perfect Negotiation Core
 * Direct Browser-to-Browser File Transfer
 */

class P2PManager {
    constructor() {
        // Signaling
        this.ws = null;
        this.role = null; // polite or impolite
        this.partnerJoined = false;
        this.clientId = null;

        // WebRTC
        this.pc = null;
        this.dataChannel = null;
        this.makingOffer = false;
        this.ignoreOffer = false;
        
        // Transfer State
        this.selectedFiles = [];
        this.isTransferring = false;
        this.receiveBuffer = [];
        this.receivedSize = 0;
        this.currentMeta = null;

        // UI
        this.cacheElements();
        this.init();
    }

    cacheElements() {
        this.els = {
            status: document.getElementById("status"),
            statusText: document.querySelector(".status-text"),
            dropZone: document.getElementById("dropZone"),
            fileInput: document.getElementById("fileInput"),
            transferSection: document.getElementById("transferSection"),
            fileList: document.getElementById("fileList"),
            progressArea: document.getElementById("progressArea"),
            progressFill: document.getElementById("progressFill"),
            percentDone: document.getElementById("percentDone"),
            currentFileName: document.getElementById("currentFileName"),
            transferSpeed: document.getElementById("transferSpeed"),
            totalStats: document.getElementById("totalStats"),
            sendBtn: document.getElementById("sendBtn"),
            clearBtn: document.getElementById("clearBtn")
        };
    }

    init() {
        this.initSignaling();
        this.setupEventListeners();
    }

    // --- Signaling ---

    initSignaling() {
        // Connect to /ws endpoint - auto-detect protocol
        const protocol = location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${location.host}/ws`;
        console.log("🔌 Connecting to:", wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => this.updateStatus("Waiting for partner...", "info");
        
        this.ws.onmessage = async ({ data }) => {
            const msg = JSON.parse(data);
            
            switch (msg.type) {
                case "init":
                    this.clientId = msg.id;
                    this.role = msg.role;
                    this.partnerJoined = true;
                    this.updateStatus("Partner Joined - Establishing P2P...", "ready");
                    await this.initPeerConnection();
                    break;
                
                case "offer":
                    await this.handleOffer(msg.offer);
                    break;
                
                case "answer":
                    await this.handleAnswer(msg.answer);
                    break;
                
                case "ice":
                    await this.handleIce(msg.candidate);
                    break;
                
                case "reset":
                    this.handleReset();
                    break;

                case "error":
                    this.updateStatus(msg.message, "error");
                    break;
            }
        };

        this.ws.onclose = () => this.updateStatus("Disconnected from signaling server", "error");
    }

    updateStatus(text, type) {
        this.els.statusText.textContent = text;
        this.els.status.className = `status-indicator ${type}`;
    }

    // --- WebRTC Core (Perfect Negotiation) ---

    async initPeerConnection() {
        if (this.pc) this.pc.close();

        this.pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        // 1. Handle Negotiation Needed (Impolite side initiates)
        this.pc.onnegotiationneeded = async () => {
            try {
                this.makingOffer = true;
                await this.pc.setLocalDescription();
                this.ws.send(JSON.stringify({ type: "offer", offer: this.pc.localDescription }));
            } catch (err) {
                console.error("Negotiation Error:", err);
            } finally {
                this.makingOffer = false;
            }
        };

        // 2. Handle ICE Candidates
        this.pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                this.ws.send(JSON.stringify({ type: "ice", candidate }));
            }
        };

        // 3. Handle Data Channel Creation
        if (this.role === "impolite") {
            this.setupDataChannel(this.pc.createDataChannel("transfer"));
        } else {
            this.pc.ondatachannel = (e) => this.setupDataChannel(e.channel);
        }

        // Connection Monitoring
        this.pc.onconnectionstatechange = () => {
            if (this.pc.connectionState === "connected") {
                this.updateStatus("P2P Connected - Ready to Transfer", "ready");
                this.updateUI();
            }
        };
    }

    async handleOffer(offer) {
        try {
            const offerCollision = (offer.type === "offer") && 
                                 (this.makingOffer || this.pc.signalingState !== "stable");
            
            this.ignoreOffer = this.role !== "polite" && offerCollision;
            if (this.ignoreOffer) return;

            await this.pc.setRemoteDescription(offer);
            if (offer.type === "offer") {
                await this.pc.setLocalDescription();
                this.ws.send(JSON.stringify({ type: "answer", answer: this.pc.localDescription }));
            }
        } catch (err) {
            console.error("Offer Error:", err);
        }
    }

    async handleAnswer(answer) {
        try {
            await this.pc.setRemoteDescription(answer);
        } catch (err) {
            console.error("Answer Error:", err);
        }
    }

    async handleIce(candidate) {
        try {
            await this.pc.addIceCandidate(candidate);
        } catch (err) {
            if (!this.ignoreOffer) console.error("ICE Error:", err);
        }
    }

    // --- Data Channel & Transfers ---

    setupDataChannel(channel) {
        this.dataChannel = channel;
        this.dataChannel.binaryType = "arraybuffer";

        this.dataChannel.onopen = () => {
            console.log("✅ DataChannel Open - readyState:", this.dataChannel.readyState);
            this.updateUI();
        };

        this.dataChannel.onmessage = (e) => this.handleIncomingData(e.data);
        
        this.dataChannel.onclose = () => {
            console.log("❌ DataChannel Closed");
            this.updateStatus("Connection Closed", "info");
            this.updateUI();
        };
        
        this.dataChannel.onerror = (e) => {
            console.error("❌ DataChannel Error:", e);
        };
    }

    async sendFiles() {
        console.log("🚀 sendFiles called");
        console.log("   dataChannel:", this.dataChannel);
        console.log("   readyState:", this.dataChannel?.readyState);
        console.log("   selectedFiles:", this.selectedFiles.length);
        
        if (!this.dataChannel || this.dataChannel.readyState !== "open") {
            console.error("❌ Cannot send: DataChannel not open");
            return;
        }
        
        this.isTransferring = true;
        this.els.progressArea.style.display = "block";
        this.updateUI();

        for (const file of this.selectedFiles) {
            console.log("📤 Sending file:", file.name, file.size, "bytes");
            await this.transferSingleFile(file);
            console.log("✅ Finished sending:", file.name);
        }

        this.isTransferring = false;
        this.selectedFiles = [];
        this.els.progressArea.style.display = "none";
        this.updateUI();
        this.updateStatus("All Transfers Complete", "ready");
    }

    async transferSingleFile(file) {
        return new Promise(async (resolve) => {
            this.els.currentFileName.textContent = file.name;
            
            // 1. Send Metadata
            this.dataChannel.send(JSON.stringify({
                type: "meta",
                name: file.name,
                size: file.size
            }));

            // 2. Stream Chunks
            const CHUNK_SIZE = 16384; // 16KB for stability
            let offset = 0;
            const startTime = Date.now();

            const stream = () => {
                while (offset < file.size) {
                    // Backpressure check
                    if (this.dataChannel.bufferedAmount > 1024 * 1024) {
                        this.dataChannel.onbufferedamountlow = () => {
                            this.dataChannel.onbufferedamountlow = null;
                            stream();
                        };
                        return;
                    }

                    const chunk = file.slice(offset, offset + CHUNK_SIZE);
                    // Read and send
                    const reader = new FileReader();
                    reader.onload = () => {
                        this.dataChannel.send(reader.result);
                        offset += reader.result.byteLength;
                        
                        this.updateProgress(offset, file.size, startTime);
                        
                        if (offset >= file.size) {
                            this.dataChannel.send(JSON.stringify({ type: "done" }));
                            resolve();
                        } else {
                            stream();
                        }
                    };
                    reader.readAsArrayBuffer(chunk);
                    return; // Wait for reader.onload
                }
            };

            this.dataChannel.bufferedAmountLowThreshold = 65536;
            stream();
        });
    }

    handleIncomingData(data) {
        if (typeof data === "string") {
            const msg = JSON.parse(data);
            if (msg.type === "meta") {
                this.currentMeta = msg;
                this.receiveBuffer = [];
                this.receivedSize = 0;
                this.els.progressArea.style.display = "block";
                this.els.currentFileName.textContent = `Receiving: ${msg.name}`;
                this.startTime = Date.now();
            } else if (msg.type === "done") {
                this.saveReceivedFile();
            }
            return;
        }

        // Binary chunk
        this.receiveBuffer.push(data);
        this.receivedSize += data.byteLength;
        this.updateProgress(this.receivedSize, this.currentMeta.size, this.startTime);
    }

    saveReceivedFile() {
        const blob = new Blob(this.receiveBuffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.currentMeta.name;
        a.click();
        
        this.els.progressArea.style.display = "none";
        this.updateStatus(`Received ${this.currentMeta.name}`, "ready");
        this.currentMeta = null;
    }

    // --- UI Logic ---

    setupEventListeners() {
        this.els.dropZone.onclick = () => this.els.fileInput.click();
        
        this.els.fileInput.onchange = (e) => this.handleFiles(e.target.files);
        
        this.els.dropZone.ondragover = (e) => {
            e.preventDefault();
            this.els.dropZone.classList.add("active");
        };

        this.els.dropZone.ondragleave = () => this.els.dropZone.classList.remove("active");

        this.els.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.els.dropZone.classList.remove("active");
            this.handleFiles(e.dataTransfer.files);
        };

        this.els.sendBtn.onclick = () => this.sendFiles();
        
        this.els.clearBtn.onclick = () => {
            this.selectedFiles = [];
            this.updateUI();
        };

        // Window globals for remove
        window.removeFile = (idx) => {
            this.selectedFiles.splice(idx, 1);
            this.updateUI();
        };
    }

    handleFiles(files) {
        this.selectedFiles = [...this.selectedFiles, ...Array.from(files)];
        this.updateUI();
    }

    updateUI() {
        const hasFiles = this.selectedFiles.length > 0;
        this.els.transferSection.style.display = hasFiles ? "block" : "none";
        
        const dcExists = !!this.dataChannel;
        const dcOpen = this.dataChannel?.readyState === "open";
        const isReady = dcExists && dcOpen && !this.isTransferring;
        
        console.log("🔄 updateUI - dcExists:", dcExists, "dcOpen:", dcOpen, "isTransferring:", this.isTransferring, "hasFiles:", hasFiles, "-> sendBtn.disabled:", !isReady || !hasFiles);
        
        this.els.sendBtn.disabled = !isReady || !hasFiles;

        this.els.fileList.innerHTML = this.selectedFiles.map((file, i) => `
            <div class="file-item">
                <i class="fas fa-file"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${this.formatBytes(file.size)}</span>
                </div>
                <button class="remove-btn" onclick="removeFile(${i})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join("");
    }

    updateProgress(current, total, startTime) {
        const percent = (current / total) * 100;
        this.els.progressFill.style.width = `${percent}%`;
        this.els.percentDone.textContent = `${Math.round(percent)}%`;

        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0) {
            const speed = current / elapsed;
            this.els.transferSpeed.textContent = `${this.formatBytes(speed)}/s`;
            this.els.totalStats.textContent = `${this.formatBytes(current)} of ${this.formatBytes(total)}`;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    handleReset() {
        this.updateStatus("Partner left. Waiting for new connection...", "info");
        if (this.pc) this.pc.close();
        this.pc = null;
        this.dataChannel = null;
        this.partnerJoined = false;
        this.updateUI();
    }
}

// Start
document.addEventListener("DOMContentLoaded", () => {
    window.manager = new P2PManager();
});
