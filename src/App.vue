<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { Cropper, type Coordinates, type CropperResult } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

type OutputFormat = 'png' | 'jpeg' | 'webp' | 'ico';
type BgColor = 'white' | 'black';
type EditMode = 'ratio' | 'size' | 'free';

// --- State ---
const imgSrc = ref<string | null>(null);
const fileName = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null);
const cropperRef = ref<any>(null);
const isDragging = ref(false); // ドラッグ中フラグ

const imageMeta = reactive({ width: 0, height: 0 });
const customRatio = reactive({ w: 4, h: 3 });

const config = reactive({
  format: 'png' as OutputFormat,
  bgColor: 'white' as BgColor,
  mode: 'size' as EditMode,
  width: 0,
  height: 0,
  aspectRatio: -2,
});

const icoSizes: Record<number, boolean> = reactive({
  16: false,
  24: false,
  32: true,
  48: false,
  64: true,
  128: true,
  256: true,
});

const coordinates = ref<Coordinates>({ width: 0, height: 0, left: 0, top: 0 });

// --- Computed ---

const isLoaded = computed(() => !!imgSrc.value);

const getCustomAspectRatio = () => {
  if (!Number.isFinite(customRatio.w) || !Number.isFinite(customRatio.h)) return null;
  if (customRatio.w <= 0 || customRatio.h <= 0) return null;
  return customRatio.w / customRatio.h;
};

const stencilProps = computed(() => {
  if (config.mode === 'ratio') {
    if (config.aspectRatio === -1) {
      const ratio = getCustomAspectRatio();
      return { aspectRatio: ratio ?? 0 };
    }
    if (config.aspectRatio === -2 && imageMeta.width > 0 && imageMeta.height > 0) return { aspectRatio: imageMeta.width / imageMeta.height };
    if (config.aspectRatio > 0) return { aspectRatio: config.aspectRatio };
  }
  if (config.mode === 'size' && config.width > 0 && config.height > 0) {
    return { aspectRatio: config.width / config.height };
  }
  return { aspectRatio: 0 };
});

const normalizeSizeConfig = () => {
  if (!Number.isFinite(config.width)) config.width = 0;
  if (!Number.isFinite(config.height)) config.height = 0;

  if (config.width < 0) config.width = 0;
  if (config.height < 0) config.height = 0;

  if (imageMeta.width > 0 && config.width > imageMeta.width) config.width = imageMeta.width;
  if (imageMeta.height > 0 && config.height > imageMeta.height) config.height = imageMeta.height;

  if (config.mode === 'size' && imageMeta.width > 0 && imageMeta.height > 0) {
    if (config.width <= 0 && config.height <= 0) {
      config.width = imageMeta.width;
      config.height = imageMeta.height;
    }
  }
};

const syncStencilToSize = () => {
  if (!cropperRef.value || config.mode !== 'size') return;
  if (imageMeta.width <= 0 || imageMeta.height <= 0) return;
  if (config.width <= 0 || config.height <= 0) return;

  const width = Math.min(config.width, imageMeta.width);
  const height = Math.min(config.height, imageMeta.height);
  let left = coordinates.value.left;
  let top = coordinates.value.top;

  if (coordinates.value.width === 0 && coordinates.value.height === 0) {
    left = Math.max(0, (imageMeta.width - width) / 2);
    top = Math.max(0, (imageMeta.height - height) / 2);
  }

  const maxLeft = Math.max(0, imageMeta.width - width);
  const maxTop = Math.max(0, imageMeta.height - height);
  left = Math.min(Math.max(left, 0), maxLeft);
  top = Math.min(Math.max(top, 0), maxTop);

  cropperRef.value.setCoordinates({ width, height, left, top }, { autoZoom: true });
};

const fitStencilToRatio = (ratio: number) => {
  if (!cropperRef.value || config.mode !== 'ratio') return;
  if (imageMeta.width <= 0 || imageMeta.height <= 0) return;
  if (!Number.isFinite(ratio) || ratio <= 0) return;

  const imageRatio = imageMeta.width / imageMeta.height;
  let width = 0;
  let height = 0;

  if (imageRatio > ratio) {
    height = imageMeta.height;
    width = height * ratio;
  } else {
    width = imageMeta.width;
    height = width / ratio;
  }

  const left = Math.max(0, (imageMeta.width - width) / 2);
  const top = Math.max(0, (imageMeta.height - height) / 2);
  cropperRef.value.setCoordinates({ width, height, left, top }, { autoZoom: true });
};

// --- Methods ---

const triggerUpload = () => {
  fileInput.value?.click();
};

// ファイル読み込みの共通処理
const processFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルのみ対応しています');
    return;
  }
  
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const result = evt.target?.result as string;
    imgSrc.value = result;
    
    const img = new Image();
    img.onload = () => {
      imageMeta.width = img.naturalWidth;
      imageMeta.height = img.naturalHeight;
      config.width = imageMeta.width;
      config.height = imageMeta.height;
      normalizeSizeConfig();
      syncStencilToSize();
    };
    img.src = result;

    // リセット
    config.width = 0;
    config.height = 0;
    isDragging.value = false;
  };
  reader.readAsDataURL(file);
};

// inputタグからの変更イベント
const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processFile(target.files[0]);
  }
};

// --- Drag & Drop Handlers ---
const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const onDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    processFile(e.dataTransfer.files[0]);
  }
};

const checkMaxSize = (type: 'w' | 'h') => {
  if (config.width < 0) config.width = 0;
  if (config.height < 0) config.height = 0;

  if (type === 'w' && imageMeta.width > 0 && config.width > imageMeta.width) config.width = imageMeta.width;
  if (type === 'h' && imageMeta.height > 0 && config.height > imageMeta.height) config.height = imageMeta.height;

  normalizeSizeConfig();
  syncStencilToSize();
};

const onChange = ({ coordinates: coords }: CropperResult) => {
  coordinates.value = coords;
};

watch(
  () => [config.mode, config.width, config.height, imageMeta.width, imageMeta.height],
  () => {
    if (!isLoaded.value) return;
    normalizeSizeConfig();
    syncStencilToSize();
  },
);

watch(
  () => [config.mode, config.aspectRatio, customRatio.w, customRatio.h, imageMeta.width, imageMeta.height],
  () => {
    if (!isLoaded.value || config.mode !== 'ratio') return;

    let ratio: number | null = null;
    if (config.aspectRatio === -1) ratio = getCustomAspectRatio();
    if (config.aspectRatio === -2 && imageMeta.width > 0 && imageMeta.height > 0) ratio = imageMeta.width / imageMeta.height;
    if (config.aspectRatio > 0) ratio = config.aspectRatio;

    if (ratio) fitStencilToRatio(ratio);
  },
);

watch(
  () => config.format,
  (format) => {
    if (format === 'ico') {
      config.mode = 'ratio';
      config.aspectRatio = 1;
    }
  },
);

// ICOファイル生成用ヘルパー関数
const generateIcoFile = async (canvas: HTMLCanvasElement, sizes: number[]): Promise<Blob> => {
  const images: { size: number; data: Uint8Array }[] = [];

  // 各サイズのPNGを生成
  for (const size of sizes) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) continue;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, size, size);

    const blob = await new Promise<Blob>((resolve) => {
      tempCanvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const arrayBuffer = await blob.arrayBuffer();
    images.push({ size, data: new Uint8Array(arrayBuffer) });
  }

  // ICOファイルヘッダー構築
  const numImages = images.length;
  const headerSize = 6 + numImages * 16;
  let totalSize = headerSize;
  images.forEach(img => totalSize += img.data.length);

  const icoData = new Uint8Array(totalSize);
  const view = new DataView(icoData.buffer);

  // ICONDIRヘッダー
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type: 1 = ICO
  view.setUint16(4, numImages, true); // Number of images

  // ICONDIRENTRYとイメージデータ
  let offset = headerSize;
  for (let i = 0; i < numImages; i++) {
    const img = images[i];
    const entryOffset = 6 + i * 16;

    view.setUint8(entryOffset + 0, img.size === 256 ? 0 : img.size); // Width
    view.setUint8(entryOffset + 1, img.size === 256 ? 0 : img.size); // Height
    view.setUint8(entryOffset + 2, 0); // Color palette
    view.setUint8(entryOffset + 3, 0); // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color planes
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
    view.setUint32(entryOffset + 8, img.data.length, true); // Image data size
    view.setUint32(entryOffset + 12, offset, true); // Image data offset

    icoData.set(img.data, offset);
    offset += img.data.length;
  }

  return new Blob([icoData], { type: 'image/x-icon' });
};

// Download Image
const downloadImage = async () => {
  if (!cropperRef.value) return;
  
  const result = cropperRef.value.getResult();
  if (!result || !result.canvas || result.canvas.width === 0 || result.canvas.height === 0) {
    return;
  }

  const { canvas } = result;
  const baseName = fileName.value.replace(/\.[^/.]+$/, "");

  // ICO形式の特別処理
  if (config.format === 'ico') {
    const selectedSizes = Object.entries(icoSizes)
      .filter(([_, checked]) => checked)
      .map(([size]) => parseInt(size))
      .sort((a, b) => a - b);

    if (selectedSizes.length === 0) {
      alert('少なくとも1つのサイズを選択してください');
      return;
    }

    const icoBlob = await generateIcoFile(canvas, selectedSizes);
    const url = URL.createObjectURL(icoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.ico`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // 通常の画像形式の処理
  const outputCanvas = document.createElement('canvas');
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return;

  let targetW = coordinates.value.width;
  let targetH = coordinates.value.height;

  if (config.mode === 'size' && config.width > 0 && config.height > 0) {
    targetW = config.width;
    targetH = config.height;
  }

  if (targetW <= 0 || targetH <= 0) return;

  outputCanvas.width = targetW;
  outputCanvas.height = targetH;

  if (config.format === 'jpeg') {
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  try {
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
  } catch (e) {
    return;
  }

  let suffix = "";
  
  if (config.mode === 'size' && config.width > 0 && config.height > 0) {
    suffix = `_${config.width}x${config.height}`;
  } else {
    suffix = `_crop`;
  }

  const mimeType = `image/${config.format}`;
  const extension = config.format === 'jpeg' ? 'jpg' : config.format;

  outputCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}${suffix}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, mimeType, 0.9);
};
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto font-sans text-gray-800">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Picture Converter</h1>
      <input 
        type="file" 
        ref="fileInput"
        accept="image/*" 
        @change="onFileChange" 
        class="hidden"
      />
      <!-- <button 
        @click="triggerUpload"
        class="bg-gray-800 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition"
      >
        ファイルを選択
      </button> -->
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <div 
        class="lg:col-span-2 bg-gray-100 rounded-lg overflow-hidden border-2 relative flex flex-col justify-center min-h-[500px] transition-colors duration-200"
        :class="isDragging ? 'border-green-500 bg-green-50' : 'border-gray-200'"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        
        <div v-if="isDragging" class="absolute inset-0 z-50 flex items-center justify-center bg-green-100/80 pointer-events-none">
          <p class="text-2xl font-bold text-green-700">ここに画像をドロップ</p>
        </div>

        <template v-if="isLoaded">
          <Cropper
            ref="cropperRef"
            class="cropper"
            :src="imgSrc"
            :stencil-props="stencilProps"
            @change="onChange"
          />
          <div class="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
            Original: {{ imageMeta.width }} x {{ imageMeta.height }}
          </div>
        </template>

        <template v-else>
          <div 
            @click="triggerUpload"
            class="flex flex-col items-center justify-center h-full cursor-pointer text-gray-400 hover:text-gray-600 transition p-10"
          >
            <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p class="text-lg font-medium">画像をアップロード</p>
            <p class="text-sm mt-2">クリック または ドラッグ＆ドロップ</p>
          </div>
        </template>
      </div>

      <div 
        class="flex flex-col gap-6 bg-white p-4 rounded-lg shadow border transition-opacity duration-300"
        :class="{ 'opacity-50 pointer-events-none select-none': !isLoaded }"
      >
        
        <div>
          <h3 class="font-bold mb-2 border-b pb-1">編集モード</h3>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="config.mode" value="size" class="mr-2">
              サイズ指定
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="config.mode" value="ratio" class="mr-2">
              比率指定
            </label>
            <label class="flex items-center gap-2 cursor-pointer col-span-2">
              <input type="radio" v-model="config.mode" value="free" class="mr-2">
              フリー
            </label>
          </div>
        </div>

        <div class="bg-gray-50 p-3 rounded">
          
          <div v-if="config.mode === 'size'">
            <p class="text-sm mb-2 text-gray-600">出力サイズ (px)</p>
            <div class="flex gap-2 items-center mb-1">
              <div class="flex flex-col">
                <input 
                  type="number" 
                  v-model.number="config.width" 
                  @input="checkMaxSize('w')"
                  class="border rounded p-1 w-24" 
                  placeholder="幅"
                  min="1"
                >
                <span class="text-[10px] text-gray-400">Max: {{ imageMeta.width }}</span>
              </div>
              <span>x</span>
              <div class="flex flex-col">
                <input 
                  type="number" 
                  v-model.number="config.height" 
                  @input="checkMaxSize('h')"
                  class="border rounded p-1 w-24" 
                  placeholder="高さ"
                  min="1"
                >
                <span class="text-[10px] text-gray-400">Max: {{ imageMeta.height }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">※空欄の場合は比率固定を解除</p>
          </div>

          <div v-else-if="config.mode === 'free'">
            <pre class="text-xs text-gray-600 leading-tight whitespace-pre font-sans">
 /\_/\\
( o.o )
 > ^ <      </pre>
          </div>

          <div v-else-if="config.mode === 'ratio'">
            <p class="text-sm mb-2 text-gray-600">アスペクト比</p>
            <select v-model.number="config.aspectRatio" class="border rounded p-1 w-full mb-3">
              <option :value="-2">Original</option>
              <option :value="1">1 : 1</option>
              <option :value="16/9">16 : 9</option>
              <option :value="4/3">4 : 3</option>
              <option :value="3/2">3 : 2</option>
              <option :value="-1">Custom...</option>
            </select>

            <div v-if="config.aspectRatio === -1" class="flex gap-2 items-center bg-white p-2 rounded border">
              <input type="number" v-model.number="customRatio.w" class="border p-1 w-16 text-center" placeholder="W" min="1">
              <span>:</span>
              <input type="number" v-model.number="customRatio.h" class="border p-1 w-16 text-center" placeholder="H" min="1">
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-bold mb-2 border-b pb-1">出力設定</h3>
          <label class="block text-sm mb-1">フォーマット</label>
          <select v-model="config.format" class="border rounded p-2 w-full mb-3">
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="webp">WebP</option>
            <option value="ico">ICO</option>
          </select>

          <div v-if="config.format === 'jpeg'">
            <label class="block text-sm mb-1">背景色 (透過部分)</label>
            <div class="flex gap-3">
              <button 
                @click="config.bgColor = 'white'"
                class="w-8 h-8 rounded border-2 shadow-sm"
                :class="config.bgColor === 'white' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-300'"
                style="background-color: white;"
                title="White"
              ></button>
              <button 
                @click="config.bgColor = 'black'"
                class="w-8 h-8 rounded border-2 shadow-sm"
                :class="config.bgColor === 'black' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-300'"
                style="background-color: black;"
                title="Black"
              ></button>
            </div>
          </div>

          <div v-if="config.format === 'ico'">
            <label class="block text-sm mb-2">含めるサイズ (px)</label>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="size in [16, 24, 32, 48, 64, 128, 256]" :key="size" class="flex items-center cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  v-model="icoSizes[size]" 
                  class="mr-2"
                >
                {{ size }}x{{ size }}
              </label>
            </div>
          </div>
        </div>

        <button 
          @click="downloadImage"
          class="mt-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded shadow transition"
        >
          Download Image
        </button>

      </div>
    </div>
  </div>
</template>

<style>
.cropper {
  height: 500px;
  background: #ddd;
}
</style>
