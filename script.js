// KONFIGURASI
const TM_MODEL_URL = "./my-model/";
// Verify model files exist at these paths:
// ./my-model/model.json
// ./my-model/metadata.json
// ./my-model/weights.bin
// API key Gemini dari aistudio.google.com
// INGAT: key ini terlihat publik di GitHub
const GEMINI_KEY = "AIzaSyB3hUoL7Xa4R_8hGuz91UVqHA26h-YO4Rg"; // ganti dengan key kamu
// Nama model Gemini yang digunakan
const GEMINI_MODEL = "gemini-2.5-flash";
// STATE — variabel yang dibutuhkan oleh beberapa fungsi
let model; // model TM yang dimuat
let webcam; // objek webcam TM
let labelContainer; // div untuk menampilkan label
let maxPredictions; // jumlah kelas
let isRunning = false; // apakah prediksi sedang berjalan
// TEACHABLE MACHINE: INISIALISASI
async function initTeachableMachine() {
  const btn = document.getElementById('start-btn');
  btn.textContent = 'Memuat model...';
  btn.disabled = true;

  try {
    const modelURL = TM_MODEL_URL + 'model.json';
    const metaURL  = TM_MODEL_URL + 'metadata.json';

    // Let tmImage.load() handle everything — it fetches model.json,
    // reads weightsManifest paths, and streams weights.bin itself.
    // Manually pre-fetching weights and discarding the buffer is what
    // causes the "has 0 values" error.
    model = await tmImage.load(modelURL, metaURL);
    maxPredictions = model.getTotalClasses();

    const flip = true;
    webcam = new tmImage.Webcam(300, 300, flip);
    await webcam.setup();
    await webcam.play();

    document.getElementById('webcam-container').appendChild(webcam.canvas);

    labelContainer = document.getElementById('label-container');
    labelContainer.innerHTML = '';
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement('div'));
    }

    btn.textContent = 'Kamera aktif ✓';
    btn.style.background = '#48bb78';
    isRunning = true;
    window.requestAnimationFrame(predictionLoop);

  } catch (err) {
    btn.textContent = 'Gagal memuat — coba lagi';
    btn.disabled = false;
    console.error('TM Error:', err);
  }
}
// TEACHABLE MACHINE: PREDICTION LOOP
// Loop ini dipanggil setiap kali browser siap render frame
// (~60 kali per detik). requestAnimationFrame lebih efisien
// dari setInterval karena browser bisa pause saat tab tidak aktif.
async function predictionLoop() {
if (!isRunning) return;
webcam.update(); // ambil frame terbaru dari kamera
// Jalankan prediksi pada frame saat ini
// model.predict() mengembalikan array objek:
// [{ className: 'Senyum', probability: 0.94 }, ...]
const predictions = await model.predict(webcam.canvas);

// Update tampilan label untuk setiap kelas
for (let i = 0; i < maxPredictions; i++) {
const pct = (predictions[i].probability * 100).toFixed(1);
const name = predictions[i].className;
// Buat progress bar visual
labelContainer.childNodes[i].innerHTML =
  `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
    <span>${name}</span>
    <strong>${pct}%</strong>
  </div>
  <div style="background:#e2e8f0;border-radius:4px;height:6px;">
    <div style="background:#667eea;width:${pct}%;height:100%;border-radius:4px;transition:width 0.1s;"></div>
  </div>`;
}
// Panggil diri sendiri untuk frame berikutnya
window.requestAnimationFrame(predictionLoop);
}
// Bind tombol ke fungsi init
document.getElementById('start-btn')
.addEventListener('click', initTeachableMachine);

// GEMINI API: FUNGSI UTAMA
async function askGemini() {
const promptInput = document.getElementById('prompt-input');
const answerBox = document.getElementById('answer-box');

const askBtn = document.getElementById('ask-btn');
const prompt = promptInput.value.trim();
// Validasi input
if (!prompt) {
answerBox.textContent = 'Tuliskan pertanyaanmu dulu!';
answerBox.className = '';
return;
}
// UI state: loading
answerBox.textContent = 'Gemini sedang berpikir...';
askBtn.disabled = true;
// Endpoint Gemini API
const endpoint =
`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:
generateContent?key=${GEMINI_KEY}`;
// Payload request (format JSON sesuai Gemini API spec)
const payload = {
contents: [{
parts: [{ text: prompt }]
}],
generationConfig: {
temperature: 0.7, // kreativitas (0=konservatif, 1=kreatif)
maxOutputTokens: 512 // batasi panjang respons
}
};
try {
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
// Cek status HTTP sebelum parse JSON
if (!response.ok) {
const errData = await response.json();
throw new Error(`API Error ${response.status}:

${errData.error?.message ?? 'Unknown error'}`);
}
const data = await response.json();
// Navigasi struktur respons Gemini
const answer = data?.candidates?.[0]
?.content?.parts?.[0]?.text;
answerBox.textContent = answer ?? 'Tidak ada jawaban.';
} catch (err) {
// Pesan error yang informatif
if (err.message.includes('Failed to fetch')) {
answerBox.textContent = 'Tidak ada koneksi internet.';
} else if (err.message.includes('403')) {
answerBox.textContent = 'API key tidak valid.';
} else if (err.message.includes('429')) {
answerBox.textContent = 'Rate limit. Tunggu.';
} else {
answerBox.textContent = 'Error: ' + err.message;
}
console.error('Gemini Error:', err);
} finally {
// Always re-enable button
askBtn.disabled = false;
}
}
document.getElementById('ask-btn')
.addEventListener('click', askGemini);
// Kirim dengan Enter (Shift+Enter untuk newline)
document.getElementById('prompt-input')
.addEventListener('keydown', (e) => {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
askGemini();
}
});