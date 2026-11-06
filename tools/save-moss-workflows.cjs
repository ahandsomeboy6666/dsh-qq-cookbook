const http = require('http');
const crypto = require('crypto');
const id = () => crypto.randomUUID();
const PORT = 55388;
function mkWorkflow(w, h, steps, cfg) {
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'moss_image_sft_int8_convrot.safetensors', weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3.5_9b_w4a8_gptq.safetensors', type: 'moss_image', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: 'masterpiece, best quality, intricate details, 1girl, solo, beautiful detailed eyes, anime style', clip: ['2', 0] } },
    '5': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, bad hands, extra legs, text, worst quality, low quality, blurry', clip: ['2', 0] } },
    '6': { class_type: 'EmptySD3LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    '7': { class_type: 'KSampler', inputs: { seed: 42, steps, cfg, sampler_name: 'euler', scheduler: 'simple', denoise: 1, model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'moss', images: ['8', 0] } },
  };
}
function params(wf, w, h, steps, cfg) {
  return [
    { id: id(), name: 'prompt', label: '提示词（自然语言最佳）', type: 'STRING', nodeId: '4', inputKey: 'text', default: wf['4'].inputs.text },
    { id: id(), name: 'negative', label: '负面', type: 'STRING', nodeId: '5', inputKey: 'text', default: wf['5'].inputs.text },
    { id: id(), name: 'seed', label: '种子（随机）', type: 'number', nodeId: '7', inputKey: 'seed', default: 42, random: true, numberKind: 'int', min: 0, max: 2147483647, step: 1 },
    { id: id(), name: 'width', label: '宽', type: 'number', nodeId: '6', inputKey: 'width', default: w, numberKind: 'int', min: 512, max: 2048, step: 8 },
    { id: id(), name: 'height', label: '高', type: 'number', nodeId: '6', inputKey: 'height', default: h, numberKind: 'int', min: 512, max: 2048, step: 8 },
    { id: id(), name: 'steps', label: '步数', type: 'number', nodeId: '7', inputKey: 'steps', default: steps, numberKind: 'int', min: 1, max: 100, step: 1 },
    { id: id(), name: 'cfg', label: 'CFG', type: 'number', nodeId: '7', inputKey: 'cfg', default: cfg, numberKind: 'float', min: 0, max: 30, step: 0.1 },
  ];
}
function save(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/comfyui/workflows', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), origin: 'http://127.0.0.1:' + PORT } }, (res) => {
      let buf = ''; res.on('data', d => buf += d); res.on('end', () => { try { const j = JSON.parse(buf); resolve([res.statusCode, j.workflow?.id, j.workflow?.name]); } catch { resolve([res.statusCode, null, buf.slice(0, 100)]); } });
    });
    req.on('error', e => resolve([0, null, e.message]));
    req.write(data); req.end();
  });
}
(async () => {
  const fast = mkWorkflow(1024, 1024, 30, 4.5);
  const hq = mkWorkflow(1536, 2048, 30, 4.5);
  const [s1, id1, n1] = await save({ name: 'MOSS 快速（1K）', description: 'MOSS-Image 8B / 1024 / 30 步 / 约 42 秒', workflow: fast, parameters: params(fast, 1024, 1024, 30, 4.5), tags: ['moss','fast'] });
  console.log('快速:', s1, id1, n1);
  const [s2, id2, n2] = await save({ name: 'MOSS 高质量（2K）', description: 'MOSS-Image 8B / 1536x2048 / 30 步 / 约 100 秒', workflow: hq, parameters: params(hq, 1536, 2048, 30, 4.5), tags: ['moss','hq'] });
  console.log('高质量:', s2, id2, n2);
})();