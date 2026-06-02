// Traitement média via ffmpeg/ffprobe système (best-effort, jamais bloquant).
// Génère miniatures, compresse, et lit les métadonnées (dimensions / durée).
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const exec = promisify(execFile)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs')
fs.mkdirSync(THUMB_DIR, { recursive: true })

let _ffmpeg = null
export async function ffmpegAvailable() {
  if (_ffmpeg !== null) return _ffmpeg
  try { await exec('ffmpeg', ['-version']); _ffmpeg = true } catch { _ffmpeg = false }
  return _ffmpeg
}

const base = (file) => path.basename(file, path.extname(file))
const sizeOf = (file) => { try { return fs.statSync(file).size } catch { return null } }

async function probeDuration(file) {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
    const d = parseFloat(stdout.trim())
    return Number.isFinite(d) ? Math.round(d) : null
  } catch { return null }
}

async function probeDimensions(file) {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file])
    const [w, h] = stdout.trim().split('x').map(n => parseInt(n))
    return { width: Number.isFinite(w) ? w : null, height: Number.isFinite(h) ? h : null }
  } catch { return { width: null, height: null } }
}

/**
 * Traite un fichier uploadé selon son type.
 * @returns {{ url, thumbUrl, width, height, duration, size }}
 *  - url      : chemin final servi (peut changer si recompressé)
 *  - thumbUrl : miniature ou null
 */
export async function processUpload(absPath, type) {
  const result = {
    url: `/uploads/${path.basename(absPath)}`,
    thumbUrl: null, width: null, height: null, duration: null, size: sizeOf(absPath),
  }
  if (!(await ffmpegAvailable())) return result

  try {
    if (type === 'IMAGE') return await processImage(absPath, result)
    if (type === 'VIDEO') return await processVideo(absPath, result)
    if (type === 'AUDIO') return await processAudio(absPath, result)
  } catch {
    // best-effort : en cas d'erreur on garde le fichier original tel quel
  }
  return result
}

async function processImage(absPath, result) {
  const { width, height } = await probeDimensions(absPath)
  result.width = width; result.height = height

  // Compression / redimensionnement si trop grand (> 1600px de large).
  if (width && width > 1600) {
    const out = path.join(UPLOAD_DIR, `${base(absPath)}-c.jpg`)
    await exec('ffmpeg', ['-y', '-i', absPath, '-vf', "scale='min(1600,iw)':-2", '-q:v', '4', out])
    fs.promises.unlink(absPath).catch(() => {})
    result.url = `/uploads/${path.basename(out)}`
    result.size = sizeOf(out)
    const d = await probeDimensions(out); result.width = d.width; result.height = d.height
    absPath = out
  }

  // Miniature 400px webp.
  const thumb = path.join(THUMB_DIR, `${base(absPath)}.webp`)
  await exec('ffmpeg', ['-y', '-i', absPath, '-vf', "scale='min(400,iw)':-2", thumb])
  if (fs.existsSync(thumb)) result.thumbUrl = `/uploads/thumbs/${path.basename(thumb)}`
  return result
}

async function processVideo(absPath, result) {
  result.duration = await probeDuration(absPath)
  const { height } = await probeDimensions(absPath)

  // Miniature : image extraite à ~1s.
  const thumb = path.join(THUMB_DIR, `${base(absPath)}.webp`)
  await exec('ffmpeg', ['-y', '-ss', '1', '-i', absPath, '-frames:v', '1', '-vf', 'scale=480:-2', thumb])
    .catch(async () => { await exec('ffmpeg', ['-y', '-i', absPath, '-frames:v', '1', '-vf', 'scale=480:-2', thumb]) })
  if (fs.existsSync(thumb)) result.thumbUrl = `/uploads/thumbs/${path.basename(thumb)}`

  // Compression vers 720p H.264 si la source est plus grande.
  if (height && height > 720) {
    const out = path.join(UPLOAD_DIR, `${base(absPath)}-c.mp4`)
    await exec('ffmpeg', ['-y', '-i', absPath, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-crf', '28',
      '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out],
      { timeout: 120000 })
    if (fs.existsSync(out)) {
      fs.promises.unlink(absPath).catch(() => {})
      result.url = `/uploads/${path.basename(out)}`
      result.size = sizeOf(out)
    }
  }
  return result
}

async function processAudio(absPath, result) {
  result.duration = await probeDuration(absPath)
  // Compression en MP3 128k si fichier volumineux (> 3 Mo).
  if ((result.size ?? 0) > 3 * 1024 * 1024) {
    const out = path.join(UPLOAD_DIR, `${base(absPath)}-c.mp3`)
    await exec('ffmpeg', ['-y', '-i', absPath, '-c:a', 'libmp3lame', '-b:a', '128k', out], { timeout: 60000 })
    if (fs.existsSync(out)) {
      fs.promises.unlink(absPath).catch(() => {})
      result.url = `/uploads/${path.basename(out)}`
      result.size = sizeOf(out)
    }
  }
  return result
}
