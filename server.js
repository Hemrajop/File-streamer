const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

const storage = multer.diskStorage({
  destination: 'videos/',
  filename: (req, file, cb) => cb(null, Date.now() + '.mp4'),
});
const upload = multer({ storage });

app.post('/upload', upload.single('video'), (req, res) => {
  const filename = req.file.filename;
  res.redirect(`/watch.html?id=${filename.replace('.mp4', '')}`);
});

app.post('/telegram-webhook', express.json(), async (req, res) => {
  const message = req.body.message;
  if (message && message.video) {
    const fileId = message.video.file_id;

    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
      const filePath = fileRes.data.result.file_path;

      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const filename = `${Date.now()}.mp4`;
      const writer = fs.createWriteStream(`videos/${filename}`);
      const downloadRes = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
      downloadRes.data.pipe(writer);

      writer.on('finish', () => {
        axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: message.chat.id,
          text: `Your video is ready: https://yourdomain.com/watch.html?id=${filename.replace('.mp4', '')}`
        });
      });

      writer.on('error', () => console.error('Write error'));

    } catch (err) {
      console.error(err);
    }
  }

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});