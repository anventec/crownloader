const terminal = require("terminal-kit").terminal;
const ytdl = require("@distube/ytdl-core");
const { Controller, convertBits, convertFileSize, convertHz } = require("./lib");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const progress = require("progress-stream");

ffmpeg.setFfmpegPath(path.resolve("ffmpeg.exe"));

const controller = new Controller(terminal);

(async function() {
	terminal.clear();

	terminal.green(`Welcome to Crownloader! `).red("YouTube ").cyan("downloads made easy!");
	terminal.brightRed("\nSupports normal videos and shorts too ;)");
	terminal.gray("\n\nThis program was made for educational and informational purposes only.");
	terminal.gray("\nCrownloader will not be held responsible for what end users do with downloaded content.");
	terminal.gray("\nCrownloader do not own nor claim to own the rights to any of the content that end users can download.");
	terminal.gray("\nCrownloader is not associated in any way with YouTube or Google LLC.");
	terminal.gray("\nYouTube is a registered trademark of Google LLC.");
	
	let validated_url, valid_url = false;

	while (!valid_url) {
		terminal.brightMagenta("\n\nEnter the video URL: ");

		const url = await controller.getInput();

		const validation = ytdl.validateURL(url);
		
		if (!validation) {
			terminal.red("\n\nInvalid URL, please enter a new one again");
		} else {
			validated_url = `https://www.youtube.com/watch?v=${ytdl.getVideoID(url)}`;
			valid_url = true;
		};
	}

	terminal.green("\n\nSuccess! ").cyan("Fetching video data...\n");

	const basic_info = await ytdl.getBasicInfo(validated_url);
	const extended_info = await ytdl.getInfo(validated_url);
	const video_id = ytdl.getVideoID(validated_url);

	console.log(basic_info.videoDetails.chapters);

	const temp_folder = path.resolve("temp");

	if (!fs.existsSync(temp_folder)) fs.mkdirSync(temp_folder);

	const details = basic_info.videoDetails;
	const formats = extended_info.formats;

	terminal.yellow("Ignore the warning above, the 4.15.4 version of @distube/ytdl-core is the only one that works to this day.");

	terminal.green("\n\nData found!");

	terminal.cyan(`\nVideo title: `).white.bold(details.title + "\n\n");

	const resizeImage = ([ow, oh], per) => {
		return [Math.ceil((ow / 100) * per), Math.ceil((oh / 100) * per)];
	}; 

	const thumb = details.thumbnails[details.thumbnails.length - 1];

	const dlthumb = await axios.get(thumb.url, { responseType: "arraybuffer" });
	const dlbuffer = Buffer.from(dlthumb.data, "utf-8");
	const dlpath = path.join(temp_folder, `${video_id} - Thumbnail.jpg`);

	await sharp(dlbuffer).toFormat("jpg").toFile(dlpath);

	const thumbosize = [terminal.width, terminal.height * 2];
	const thumbresize = resizeImage(thumbosize, 85);

	await terminal.drawImage(dlpath, {
		shrink: {
			width: thumbresize[0],
			height: thumbresize[1]
		}
	});

	fs.rm(dlpath, () => fs.rmdirSync(temp_folder));

	const isOnlyVideo = (format) => format.hasVideo && !format.hasAudio && format.contentLength;
  const isOnlyAudio = (format) => !format.hasVideo && format.hasAudio && format.contentLength;

	const video_formats = formats.filter(isOnlyVideo);
	const audio_formats = formats.filter(isOnlyAudio);

	terminal.green("\nFound ").white.bold(video_formats.length).green(" video formats and ").white.bold(audio_formats.length).green(" audio formats.\n");

	terminal.brightMagenta("\nPlease select a video format:\n");

	terminal.gridMenu(video_formats.map((f) => {
		return `${f.qualityLabel} | ${convertBits(f.bitrate).kb}kbps | ${convertFileSize(f.contentLength)}`;
	}), (err, vfr) => {
		terminal.green("\nExcellent!");

		terminal.brightMagenta("\n\nPlease select an audio format:\n");

		terminal.gridMenu(audio_formats.map((f) => {
			return `${convertHz(f.audioSampleRate, 1).khz}kHz | ${f.audioBitrate}kbps | ${convertFileSize(f.contentLength)}`;
		}), async (err, afr) => {
			terminal.green("\nExcellent!\n");

			let save_path, is_valid_path = false;

			while(!is_valid_path) {
				terminal.brightMagenta("\nEnter the path where you want to save the video: ");

				const path = await controller.getInput();

				if (!fs.existsSync(path)) {
					terminal.red("\n\nInvalid path, please enter a new one again");
				} else {
					const lstat = fs.lstatSync(path);

					if (!lstat.isDirectory()) {
						terminal.red("\n\nGiven path is not a directory, please enter a new one again");
					} else {
						save_path = path;
						is_valid_path = true
					}
				}
			}

			const final_video_format = video_formats[vfr.selectedIndex];
			const final_audio_format = audio_formats[afr.selectedIndex];

			const sanitized_title = details.title.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, "");

			const final_video_path = path.join(save_path, `${video_id} - ${final_video_format.qualityLabel}.${final_video_format.container}`);
			const final_audio_path = path.join(save_path, `${video_id} - ${final_audio_format.audioBitrate}.${final_audio_format.container}`);
			const final_merged_path = path.join(save_path, `${sanitized_title}.mp4`);

			if (!final_audio_format.contentLength) terminal.cyan("\n\nDownloading audio...");
			else terminal("\n\n");

			let audio_progress_handler, audio_progress_bar, video_progress_handler, video_progress_bar, merge_progress_bar;

			audio_progress_handler = progress({
				length: parseInt(final_audio_format.contentLength),
				time: 100
			});

			audio_progress_handler.on("progress", (p) => {
				if (!audio_progress_bar) {
					audio_progress_bar = terminal.progressBar({
						width: 80,
						title: "Downloading audio:",
						eta: true,
						percent: true
					});
				}

				audio_progress_bar.update(p.percentage / 100);
			});

			video_progress_handler = progress({
				length: parseInt(final_video_format.contentLength),
				time: 100
			});

			video_progress_handler.on("progress", (p) => {
				if (!video_progress_bar) {
					video_progress_bar = terminal.progressBar({
						width: 80,
						title: "Downloading video:",
						eta: true,
						percent: true
					});
				}

				video_progress_bar.update(p.percentage / 100);
			});

			ytdl(validated_url, {
				format: final_audio_format
			}).pipe(audio_progress_handler).pipe(fs.createWriteStream(final_audio_path)).on("finish", () => {
				ytdl(validated_url, {
					format: final_video_format
				}).pipe(video_progress_handler).pipe(fs.createWriteStream(final_video_path)).on("finish", () => {
					ffmpeg()
					.addInput(final_video_path)
					.addInput(final_audio_path)
					.addOptions(["-map 0:v", "-map 1:a", "-c:v copy"])
					.format("mp4")
					.on("progress", (p) => {
						if (!merge_progress_bar) {
							merge_progress_bar = terminal.progressBar({
								width: 80,
								title: "Merging video and audio:",
								eta: true,
								percent: true
							});
						}
						
						merge_progress_bar.update(p.percent / 100);
					})
					.on("error", (e) => console.error("\n", e))
					.on("end", (e) => {
						if (merge_progress_bar) merge_progress_bar.stop();
						terminal.green("\n\nFull video ready! Available at: ").white.bold(final_merged_path);
						
						fs.unlink(final_video_path, () => {
							fs.unlink(final_audio_path, () => {
								terminal.cyan("\n\nAutomatically closing in 5 seconds...");

								setTimeout(() => {
									process.exit(0);
								}, 5000);
							});
						});
					})
					.saveToFile(final_merged_path);
				});
			});
		});
	});
})();