import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  HardDrive,
  Smartphone,
  Cloud,
  Link2,
  Film,
  Camera,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Pause,
  ArrowRight,
  FolderPlus,
  RefreshCw,
  Video,
  FileVideo,
  Radio,
  FileAudio,
  Sparkles,
  ExternalLink,
  Laptop,
  Check,
  Copy,
  Info,
  Layers,
  Clock,
  Wifi,
  Share2
} from "lucide-react";
import { DEMO_VIDEOS } from "../utils/demoVideos";

export interface ImportMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "sk" | "en";
  onSelectVideo: (url: string, filename: string, file?: File) => void;
  onSelectMultipleFiles?: (files: FileList | File[]) => void;
}

type ImportSourceTab = "disk" | "phone" | "cloud" | "url" | "library";

interface CloudFileItem {
  id: string;
  name: string;
  provider: "gdrive" | "dropbox" | "onedrive" | "icloud";
  size: string;
  duration: string;
  resolution: string;
  url: string;
  modified: string;
}

export const ImportMediaModal: React.FC<ImportMediaModalProps> = ({
  isOpen,
  onClose,
  language,
  onSelectVideo,
  onSelectMultipleFiles,
}) => {
  const isSk = language === "sk";
  const [activeTab, setActiveTab] = useState<ImportSourceTab>("disk");

  // Local Disk State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  // Phone / Mobile State
  const [phoneSubTab, setPhoneSubTab] = useState<"qr" | "camera" | "guide">("qr");
  const [isSimulatingPhoneTransfer, setIsSimulatingPhoneTransfer] = useState(false);
  const [phoneTransferProgress, setPhoneTransferProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const videoCameraRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Keep cameraStreamRef in sync with cameraStream state
  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  // Cloud State
  const [cloudProvider, setCloudProvider] = useState<"gdrive" | "dropbox" | "onedrive" | "icloud">("gdrive");
  const [isCloudImporting, setIsCloudImporting] = useState(false);
  const [cloudImportProgress, setCloudImportProgress] = useState(0);
  const [selectedCloudItem, setSelectedCloudItem] = useState<CloudFileItem | null>(null);

  // URL State
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  // Library State
  const [selectedLibraryDemo, setSelectedLibraryDemo] = useState<typeof DEMO_VIDEOS[0] | null>(DEMO_VIDEOS[0] || null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const demoVideoRef = useRef<HTMLVideoElement | null>(null);

  // Stop camera function defined before effects
  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraStream(null);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup on close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setSelectedLocalFile(null);
    }
  }, [isOpen, localPreviewUrl, stopCamera]);

  // Clean camera when switching away from camera tab
  useEffect(() => {
    if (activeTab !== "phone" || phoneSubTab !== "camera") {
      stopCamera();
    }
  }, [activeTab, phoneSubTab, stopCamera]);

  // Cloud demo files
  const cloudFiles: CloudFileItem[] = [
    {
      id: "cf1",
      name: "Podcast_Episode_24_MultiCam_Master.mp4",
      provider: "gdrive",
      size: "148.2 MB",
      duration: "0:45",
      resolution: "1080p • 60fps",
      url: DEMO_VIDEOS[0]?.url || "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
      modified: isSk ? "Dnes o 10:14" : "Today at 10:14 AM",
    },
    {
      id: "cf2",
      name: "iPhone15Pro_CinematicLog_Reel.mov",
      provider: "icloud",
      size: "210.5 MB",
      duration: "0:30",
      resolution: "4K HDR • 9:16",
      url: DEMO_VIDEOS[1]?.url || DEMO_VIDEOS[0]?.url || "",
      modified: isSk ? "Včera o 18:30" : "Yesterday at 6:30 PM",
    },
    {
      id: "cf3",
      name: "Product_Launch_Tech_BRoll.mp4",
      provider: "dropbox",
      size: "89.4 MB",
      duration: "0:22",
      resolution: "4K UHD • 16:9",
      url: DEMO_VIDEOS[2]?.url || DEMO_VIDEOS[0]?.url || "",
      modified: isSk ? "Pred 2 dňami" : "2 days ago",
    },
    {
      id: "cf4",
      name: "Interview_Studio_Lighting_Raw.mp4",
      provider: "onedrive",
      size: "312.0 MB",
      duration: "1:15",
      resolution: "1080p • 30fps",
      url: DEMO_VIDEOS[0]?.url || "",
      modified: isSk ? "Tento týždeň" : "This week",
    },
  ];

  // Start Camera
  const startCamera = async () => {
    try {
      setRecordedBlobUrl(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      if (videoCameraRef.current) {
        videoCameraRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access not available or denied:", err);
    }
  };

  const handleStartRecording = () => {
    if (!cameraStream) return;
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(cameraStream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      console.error("Failed to start MediaRecorder", e);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Drag & drop for disk
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedLocalFile(file);
      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLocalFile(file);
      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);
    }
  };

  const handleConfirmLocalFile = () => {
    if (localPreviewUrl && selectedLocalFile) {
      onSelectVideo(localPreviewUrl, selectedLocalFile.name, selectedLocalFile);
      onClose();
    }
  };

  // Simulate mobile phone sync
  const handleSimulatePhoneTransfer = () => {
    setIsSimulatingPhoneTransfer(true);
    setPhoneTransferProgress(10);
    const interval = setInterval(() => {
      setPhoneTransferProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulatingPhoneTransfer(false);
          const demo = DEMO_VIDEOS[0];
          onSelectVideo(demo.url, "iPhone_4K_Reel_Recorded.mov");
          onClose();
          return 100;
        }
        return prev + 25;
      });
    }, 350);
  };

  // Cloud Import trigger
  const handleImportCloudFile = (item: CloudFileItem) => {
    setSelectedCloudItem(item);
    setIsCloudImporting(true);
    setCloudImportProgress(15);
    const interval = setInterval(() => {
      setCloudImportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCloudImporting(false);
          onSelectVideo(item.url, item.name);
          onClose();
          return 100;
        }
        return prev + 30;
      });
    }, 300);
  };

  // URL import trigger
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setUrlError(isSk ? "Prosím zadajte platnú URL adresu videa." : "Please enter a valid video URL.");
      return;
    }
    setUrlError("");
    setIsFetchingUrl(true);
    setTimeout(() => {
      setIsFetchingUrl(false);
      const demo = DEMO_VIDEOS[0];
      const filename = urlInput.split("/").pop() || "Web_Video_Import.mp4";
      onSelectVideo(demo.url, filename.endsWith(".mp4") ? filename : `${filename}.mp4`);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div
      id="import-media-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="import-media-modal-window"
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-rose-950/20 overflow-hidden text-neutral-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>{isSk ? "Importovať video a médiá" : "Import Video & Media"}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                  {isSk ? "Centrum importu" : "Source Hub"}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                {isSk
                  ? "Vyberte zdroj: počítač, mobilný telefón, cloudové úložisko alebo webový odkaz"
                  : "Choose source: local disk, smartphone, cloud storage or web link"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors"
            title={isSk ? "Zavrieť" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-neutral-950 border-b border-neutral-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("disk")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "disk"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>{isSk ? "Môj disk / PC" : "Local Disk / PC"}</span>
          </button>

          <button
            onClick={() => setActiveTab("phone")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "phone"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{isSk ? "Zo smartfónu / kamery" : "From Phone / Camera"}</span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
              QR Sync
            </span>
          </button>

          <button
            onClick={() => setActiveTab("cloud")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "cloud"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>{isSk ? "Cloud úložisko" : "Cloud Storage"}</span>
          </button>

          <button
            onClick={() => setActiveTab("url")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "url"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>{isSk ? "Z URL / Odkazu" : "From Link / URL"}</span>
          </button>

          <button
            onClick={() => setActiveTab("library")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "library"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
            }`}
          >
            <Film className="w-4 h-4" />
            <span>{isSk ? "Ukážková knižnica" : "Sample Demo Library"}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[380px] flex flex-col">
          {/* TAB 1: LOCAL DISK */}
          {activeTab === "disk" && (
            <div className="flex-1 flex flex-col gap-5">
              {!selectedLocalFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                    isDragging
                      ? "border-rose-500 bg-rose-500/10 scale-[0.99]"
                      : "border-neutral-700 hover:border-neutral-600 bg-neutral-950/40"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*,audio/*,image/*"
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={multiFileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        if (onSelectMultipleFiles) onSelectMultipleFiles(e.target.files);
                        const first = e.target.files[0];
                        setSelectedLocalFile(first);
                        const url = URL.createObjectURL(first);
                        setLocalPreviewUrl(url);
                      }
                    }}
                    multiple
                    accept="video/*,audio/*,image/*"
                    className="hidden"
                  />

                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-4 text-rose-400 shadow-inner">
                    <Laptop className="w-8 h-8" />
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">
                    {isSk ? "Presuňte sem video súbory alebo kliknite pre výber" : "Drag and drop video files here or browse"}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mb-6">
                    {isSk
                      ? "Podporované formáty: MP4, MOV, WebM, MKV, MP3, WAV a fotografie pre B-Roll. Až do 4K 60fps."
                      : "Supports MP4, MOV, WebM, MKV, MP3, WAV and images for B-Roll. Up to 4K 60fps."}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isSk ? "Vybrať video z disku" : "Browse Video File"}</span>
                    </button>

                    <button
                      onClick={() => multiFileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-all flex items-center gap-2"
                    >
                      <FolderPlus className="w-4 h-4 text-amber-400" />
                      <span>{isSk ? "Nahrať priečinok / viacero súborov" : "Upload Multiple Files"}</span>
                    </button>
                  </div>

                  {/* Format chips */}
                  <div className="flex items-center gap-2 mt-8 pt-4 border-t border-neutral-800/80">
                    <span className="text-[11px] text-neutral-500 font-semibold">{isSk ? "Formáty:" : "Formats:"}</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300 font-bold">.MP4</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300 font-bold">.MOV (Apple ProRes)</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300 font-bold">.WEBM</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300 font-bold">.MKV</span>
                  </div>
                </div>
              ) : (
                /* Selected File Preview Screen */
                <div className="flex-1 flex flex-col lg:flex-row gap-6 bg-neutral-950/60 p-5 rounded-2xl border border-neutral-800">
                  {/* Left: Video Preview Player */}
                  <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-xl overflow-hidden relative aspect-video border border-neutral-800">
                    {localPreviewUrl && (
                      <video
                        src={localPreviewUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Right: File details & confirmation */}
                  <div className="w-full lg:w-72 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSk ? "Súbor pripravený na import" : "File ready for import"}</span>
                      </div>

                      <div className="bg-neutral-900 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                        <p className="text-xs font-bold text-white truncate" title={selectedLocalFile.name}>
                          {selectedLocalFile.name}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                          <div>
                            <span className="block text-neutral-500">{isSk ? "Veľkosť:" : "Size:"}</span>
                            <span className="font-semibold text-neutral-200">
                              {(selectedLocalFile.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>
                          <div>
                            <span className="block text-neutral-500">{isSk ? "Typ:" : "Type:"}</span>
                            <span className="font-semibold text-neutral-200 uppercase">
                              {selectedLocalFile.type.split("/")[1] || "Video"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {isSk
                          ? "Po potvrdení sa video okamžite načíta do prehrávača, vytvorí sa projekt a sprístupnia sa všetky AI nástroje."
                          : "After confirming, the video loads into the player with the full suite of AI editing tools."}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-4">
                      <button
                        onClick={handleConfirmLocalFile}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isSk ? "Potvrdiť a otvoriť v editore" : "Confirm & Open in Editor"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLocalFile(null);
                          if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
                          setLocalPreviewUrl(null);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
                      >
                        {isSk ? "Zvoliť iný súbor" : "Choose Another File"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SMARTPHONE / MOBILE / CAMERA */}
          {activeTab === "phone" && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Phone Sub-navigation */}
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <button
                  onClick={() => {
                    setPhoneSubTab("qr");
                    stopCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    phoneSubTab === "qr"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{isSk ? "QR Kód bezdrôtový prenos" : "QR Code Wireless Drop"}</span>
                </button>

                <button
                  onClick={() => {
                    setPhoneSubTab("camera");
                    startCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    phoneSubTab === "camera"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isSk ? "Priamy záznam z webkamery" : "Live Camera Capture"}</span>
                </button>

                <button
                  onClick={() => {
                    setPhoneSubTab("guide");
                    stopCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    phoneSubTab === "guide"
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{isSk ? "AirDrop & Kábel" : "AirDrop & USB Cable"}</span>
                </button>
              </div>

              {/* Subtab QR */}
              {phoneSubTab === "qr" && (
                <div className="flex-1 flex flex-col lg:flex-row items-center gap-8 bg-neutral-950/60 p-6 rounded-2xl border border-neutral-800">
                  {/* Left: Interactive QR Code Box */}
                  <div className="flex flex-col items-center bg-white p-5 rounded-2xl shadow-xl border-4 border-amber-500/30 relative group">
                    <div className="w-44 h-44 bg-neutral-900 rounded-xl flex items-center justify-center p-3 relative overflow-hidden">
                      {/* Stylized QR Code Pattern */}
                      <div className="grid grid-cols-6 gap-1.5 w-full h-full p-1 bg-white rounded-lg">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-xs ${
                              i === 0 || i === 5 || i === 30 || i === 14 || i === 21 || i === 17 || i === 28 || i === 7 || i === 34 || i === 12
                                ? "bg-black"
                                : i % 2 === 0
                                ? "bg-black"
                                : "bg-neutral-200"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Animated scanning line */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400 animate-pulse pointer-events-none" />
                    </div>

                    <div className="mt-3 text-center">
                      <span className="text-[11px] font-mono font-bold text-neutral-900 bg-amber-100 px-2.5 py-1 rounded-md">
                        PAIR CODE: OMNI-8492-SYNC
                      </span>
                    </div>
                  </div>

                  {/* Right: Steps & Simulated Mobile Push */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                        <Wifi className="w-4 h-4" />
                        <span>{isSk ? "Okamžitý prenos z iPhone / Android" : "Instant iPhone / Android Drop"}</span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {isSk
                          ? "Naskenujte QR kód fotoaparátom svojho smartfónu a vyberte video z galérie bez inštalácie akejkoľvek aplikácie."
                          : "Scan the QR code with your phone camera to transfer videos directly from your photo library."}
                      </p>
                    </div>

                    {/* Step Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                        <div className="text-[10px] font-bold text-amber-400 mb-1">1. KROK</div>
                        <p className="text-xs font-semibold text-neutral-200">{isSk ? "Otvorte fotoaparát" : "Open Camera"}</p>
                        <p className="text-[10px] text-neutral-400">{isSk ? "Zamerajte QR kód vľavo" : "Point at QR code"}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                        <div className="text-[10px] font-bold text-amber-400 mb-1">2. KROK</div>
                        <p className="text-xs font-semibold text-neutral-200">{isSk ? "Vyberte video" : "Pick Video"}</p>
                        <p className="text-[10px] text-neutral-400">{isSk ? "Zvoľte 4K reel alebo záznam" : "Select high-res reel"}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                        <div className="text-[10px] font-bold text-amber-400 mb-1">3. KROK</div>
                        <p className="text-xs font-semibold text-neutral-200">{isSk ? "Okamžitý edit" : "Instant Edit"}</p>
                        <p className="text-[10px] text-neutral-400">{isSk ? "Video sa načíta do timeline" : "Loads into timeline"}</p>
                      </div>
                    </div>

                    {/* Simulation / Quick Action */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      {isSimulatingPhoneTransfer ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold text-amber-400">
                            <span>{isSk ? "Prijímanie 4K videa z iPhone..." : "Receiving 4K video from iPhone..."}</span>
                            <span>{phoneTransferProgress}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
                              style={{ width: `${phoneTransferProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleSimulatePhoneTransfer}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>{isSk ? "Simulovať okamžitý prenos z mobilu (Ukážka)" : "Simulate Instant Phone Sync (Demo)"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Camera */}
              {phoneSubTab === "camera" && (
                <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-2xl border border-neutral-800 overflow-hidden p-4 relative min-h-[280px]">
                  {!recordedBlobUrl ? (
                    <>
                      <video
                        ref={videoCameraRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-w-lg aspect-video rounded-xl bg-neutral-950 object-cover border border-neutral-800"
                      />

                      {/* Camera Overlay Controls */}
                      <div className="mt-4 flex items-center gap-4">
                        {!isRecording ? (
                          <button
                            onClick={handleStartRecording}
                            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all"
                          >
                            <Radio className="w-4 h-4 text-white animate-pulse" />
                            <span>{isSk ? "Spustiť nahrávanie" : "Start Recording"}</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleStopRecording}
                            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/40 flex items-center gap-2 transition-all animate-pulse"
                          >
                            <span className="w-3 h-3 rounded-xs bg-white" />
                            <span>
                              {isSk ? `Zastaviť (${recordingTime}s)` : `Stop (${recordingTime}s)`}
                            </span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Recorded Video Preview */
                    <div className="w-full flex flex-col items-center gap-4">
                      {recordedBlobUrl && (
                        <video
                          src={recordedBlobUrl}
                          controls
                          className="w-full max-w-lg aspect-video rounded-xl bg-neutral-950 object-cover border border-neutral-800"
                        />
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            onSelectVideo(recordedBlobUrl, `Webcam_Recording_${Date.now()}.mp4`);
                            onClose();
                          }}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/30 hover:brightness-110 flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isSk ? "Použiť tento záznam" : "Use This Recording"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setRecordedBlobUrl(null);
                            startCamera();
                          }}
                          className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700"
                        >
                          {isSk ? "Nahrať znova" : "Retake"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab Guide */}
              {phoneSubTab === "guide" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-3">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <Share2 className="w-4 h-4" />
                      <span>{isSk ? "Apple AirDrop / Mac" : "Apple AirDrop / Mac"}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {isSk
                        ? "Na iPhone kliknite v aplikácii Fotky na Zdieľať → AirDrop → Vyberte váš Mac. Súbor sa uloží do Priečinka Stiahnuté súbory, odkiaľ ho presuniete sem do záložky 'Môj disk'."
                        : "On your iPhone tap Share → AirDrop → Select your Mac. The file will land in Downloads and can be dropped into the Local Disk tab."}
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                      <Laptop className="w-4 h-4" />
                      <span>{isSk ? "USB-C Kábel / Android QuickShare" : "USB-C Cable / QuickShare"}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {isSk
                        ? "Pripojte telefón cez USB-C kábel a importujte priamo vo vysokom dátovom toku (ProRes / 4K 10-bit) bez kompresie."
                        : "Connect via USB-C for raw maximum bitrate 10-bit footage without compression."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD STORAGE */}
          {activeTab === "cloud" && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Cloud Provider Tabs */}
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <button
                  onClick={() => setCloudProvider("gdrive")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    cloudProvider === "gdrive"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Google Drive</span>
                </button>

                <button
                  onClick={() => setCloudProvider("dropbox")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    cloudProvider === "dropbox"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dropbox</span>
                </button>

                <button
                  onClick={() => setCloudProvider("onedrive")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    cloudProvider === "onedrive"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Microsoft OneDrive</span>
                </button>

                <button
                  onClick={() => setCloudProvider("icloud")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    cloudProvider === "icloud"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span>Apple iCloud</span>
                </button>
              </div>

              {/* Cloud Files List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                  <span>{isSk ? "Súbory zsynchronizované v cloude" : "Synced cloud files available"}</span>
                  <span className="text-[10px] text-neutral-500">
                    {isSk ? "Kliknite pre okamžité načítanie" : "Click to load instantly"}
                  </span>
                </div>

                {isCloudImporting ? (
                  <div className="p-8 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col items-center justify-center text-center space-y-4">
                    <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">
                        {isSk ? `Sťahovanie "${selectedCloudItem?.name}"...` : `Downloading "${selectedCloudItem?.name}"...`}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {isSk ? "Optimalizácia rozlíšenia a synchronizácia audia..." : "Optimizing resolution and syncing audio..."}
                      </p>
                    </div>
                    <div className="w-64 h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
                        style={{ width: `${cloudImportProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cloudFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleImportCloudFile(file)}
                        className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-rose-500/50 hover:bg-neutral-800/40 cursor-pointer transition-all flex flex-col justify-between group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-neutral-800 group-hover:bg-rose-500/20 text-neutral-400 group-hover:text-rose-400 flex items-center justify-center shrink-0 transition-colors">
                            <FileVideo className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition-colors">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                              <span className="font-semibold text-neutral-300">{file.resolution}</span>
                              <span>•</span>
                              <span>{file.size}</span>
                              <span>•</span>
                              <span>{file.duration}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/60 text-[10px]">
                          <span className="text-neutral-500">{file.modified}</span>
                          <span className="font-bold text-rose-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            <span>{isSk ? "Importovať" : "Import"}</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FROM URL / LINK */}
          {activeTab === "url" && (
            <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full gap-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto text-rose-400 mb-2">
                  <Link2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {isSk ? "Import z priamej URL adresy alebo videa" : "Import from Video URL"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isSk
                    ? "Vložte odkaz na MP4, WebM, stream alebo online video súbor."
                    : "Paste a direct link to an MP4, WebM, stream or online clip."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (urlError) setUrlError("");
                    }}
                    placeholder="https://example.com/videos/my_clip.mp4"
                    className="w-full px-4 py-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                  {urlInput && (
                    <button
                      onClick={() => setUrlInput("")}
                      className="absolute right-3 top-3.5 text-neutral-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {urlError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{urlError}</span>
                  </div>
                )}

                {/* Quick test URL suggestions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-neutral-500">{isSk ? "Rýchle ukážky:" : "Presets:"}</span>
                  <button
                    onClick={() => setUrlInput(DEMO_VIDEOS[0]?.url || "")}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300"
                  >
                    Podcast 1080p (.mp4)
                  </button>
                  <button
                    onClick={() => setUrlInput("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4")}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300"
                  >
                    Full HD Sample (.mp4)
                  </button>
                </div>

                <button
                  onClick={handleUrlSubmit}
                  disabled={isFetchingUrl}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isFetchingUrl ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isSk ? "Sťahovanie a analýza videa..." : "Fetching and analyzing video..."}</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>{isSk ? "Stiahnuť a otvoriť v editore" : "Fetch & Open in Editor"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DEMO / SAMPLE LIBRARY */}
          {activeTab === "library" && (
            <div className="flex-1 flex flex-col lg:flex-row gap-5">
              {/* Left: Video Grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[340px] pr-1">
                {DEMO_VIDEOS.map((demo) => {
                  const isSelected = selectedLibraryDemo?.id === demo.id;
                  return (
                    <div
                      key={demo.id}
                      onClick={() => {
                        setSelectedLibraryDemo(demo);
                        setIsDemoPlaying(false);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/10"
                          : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-rose-400 font-mono uppercase">
                            {demo.category}
                          </span>
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {demo.duration}s
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-snug">
                          {isSk ? demo.titleSk : demo.titleEn}
                        </h4>
                        <p className="text-[11px] text-neutral-400 line-clamp-2">
                          {isSk ? demo.sampleTranscriptSk : demo.sampleTranscriptEn}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/60">
                        <span className="text-[10px] text-neutral-500 font-semibold">
                          {demo.defaultCaptionsSk?.length || 4} {isSk ? "segmentov" : "segments"}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {isSk ? "Zvolené" : "Selected"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected Demo Live Preview & Ingest */}
              {selectedLibraryDemo && (
                <div className="w-full lg:w-72 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="aspect-video rounded-xl bg-black overflow-hidden relative border border-neutral-800">
                      {selectedLibraryDemo.url ? (
                        <video
                          ref={demoVideoRef}
                          src={selectedLibraryDemo.url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <Film className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {isSk ? selectedLibraryDemo.titleSk : selectedLibraryDemo.titleEn}
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        {isSk ? selectedLibraryDemo.sampleTranscriptSk : selectedLibraryDemo.sampleTranscriptEn}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/80 text-[10px] space-y-1 text-neutral-300">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">{isSk ? "Dĺžka:" : "Duration:"}</span>
                        <span className="font-semibold">{selectedLibraryDemo.duration} sekúnd</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">{isSk ? "AI Titulky:" : "AI Captions:"}</span>
                        <span className="font-semibold text-amber-400">{isSk ? "Predpripravené" : "Pre-synced"}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectVideo(
                        selectedLibraryDemo.url,
                        isSk ? selectedLibraryDemo.titleSk : selectedLibraryDemo.titleEn
                      );
                      onClose();
                    }}
                    className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isSk ? "Načítať toto ukážkové video" : "Load This Demo Video"}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer info */}
        <div className="px-6 py-3 bg-neutral-950/90 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-neutral-400">
              {isSk
                ? "Všetky videá sa spracovávajú lokálne v prehliadači s maximálnym súkromím."
                : "All videos are processed securely in your browser with zero data retention."}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-neutral-400 hover:text-white text-xs hover:bg-neutral-800 transition-colors"
          >
            {isSk ? "Zrušiť" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};
