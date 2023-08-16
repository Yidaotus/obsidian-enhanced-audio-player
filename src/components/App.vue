<template>
	<div style="position: relative">
		<div
			ref="target"
			class="visibility-target"
			:class="{ 'visibility-target-buffer': showFixedPlayer }"
		/>
		<div
			:class="{
				'audio-player-ui': !showFixedPlayer,
				'audio-fixed-player': showFixedPlayer,
			}"
			tabindex="0"
		>
			<div class="player-container">
				<div class="controls">
					<div
						class="playpause"
						@click="togglePlay"
						ref="playpause"
					/>
				</div>
				<div class="spectrum">
					<div
						:class="{
							waveform: !showFixedPlayer,
							'waveform-small': showFixedPlayer,
						}"
					>
						<div
							class="wv"
							v-for="(s, i) in filteredData"
							:key="srcPath + i"
							v-bind:class="{ played: i <= currentBar }"
							@mousedown="barMouseDownHandler(i)"
							:style="{
								height: s * 100 + '%',
							}"
						></div>
					</div>
					<div class="timeline" v-if="!showFixedPlayer">
						<span class="current-time">
							{{ displayedCurrentTime }}
						</span>
						<span class="duration">
							{{ displayedDuration }}
						</span>
					</div>
				</div>
			</div>
		</div>
		<div class="comment-list">
			<AudioCommentVue
				v-for="cmt in commentsSorted"
				v-bind:class="{ 'active-comment': cmt == activeComment }"
				@play-from="playFrom"
				@move-playhead="setPlayheadSecs"
				:cmt="cmt"
				:key="cmt.timeString"
			></AudioCommentVue>
		</div>
	</div>
</template>

<script lang="ts">
import { TFile, setIcon, MarkdownPostProcessorContext } from "obsidian";
import { defineComponent, PropType, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import {
	AudioComment,
	AudioPlayCommentEventPayload,
	PlayCommentCommand,
} from "../types";
import { secondsToString, secondsToNumber } from "../utils";

import AudioCommentVue from "./AudioComment.vue";

export default defineComponent({
	name: "App",
	components: {
		AudioCommentVue,
	},
	setup() {
		const target = ref(null);
		const targetIsVisible = useElementVisibility(target);

		return {
			target,
			targetIsVisible,
		};
	},
	props: {
		filepath: { type: String, required: true },
		playerId: { type: String, required: true },
		comments: {
			type: Object as PropType<Array<AudioComment>>,
			required: true,
		},
		audio: {
			type: Object as PropType<HTMLAudioElement>,
			required: true,
		},
	},
	data() {
		return {
			toggle: false,
			items: [...Array(100).keys()],
			srcPath: "",

			filteredData: [] as number[],
			nSamples: 100,
			duration: 0,
			currentTime: 0,
			playing: false,
			button: undefined as HTMLSpanElement | undefined,

			clickCount: 0,
			newComment: "",
			activeComment: null as AudioComment | null,
		};
	},
	computed: {
		showFixedPlayer() {
			return !this.targetIsVisible && this.playing;
		},
		displayedCurrentTime() {
			return secondsToString(this.currentTime);
		},
		displayedDuration() {
			return secondsToString(this.duration);
		},
		currentBar() {
			return Math.floor(
				(this.currentTime / this.duration) * this.nSamples
			);
		},
		commentsSorted() {
			return this.comments.sort(
				(x: AudioComment, y: AudioComment) =>
					x.timeNumber - y.timeNumber
			);
		},
	},
	methods: {
		isCurrent() {
			return this.audio.src === this.srcPath;
		},
		async loadFile() {
			// read file from vault
			const file = window.app.vault.getAbstractFileByPath(
				this.filepath
			) as TFile;

			// process audio file & set audio el source
			if (file && file instanceof TFile) {
				//check cached values
				if (!this.loadCache()) this.processAudio(file.path);

				this.srcPath = window.app.vault.getResourcePath(file);
			}
		},
		saveCache() {
			localStorage[`${this.filepath}`] = JSON.stringify(
				this.filteredData
			);
			localStorage[`${this.filepath}_duration`] = this.duration;
		},
		loadCache(): boolean {
			let cachedData = localStorage[`${this.filepath}`];
			let cachedDuration = localStorage[`${this.filepath}_duration`];

			if (!cachedData) {
				return false;
			}

			this.filteredData = JSON.parse(cachedData);
			this.duration = Number.parseFloat(cachedDuration);
			return true;
		},
		async processAudio(path: string) {
			const arrBuf = await window.app.vault.adapter.readBinary(path);
			const audioContext = new AudioContext();
			const tempArray = [] as number[];

			audioContext.decodeAudioData(arrBuf, (buf) => {
				let rawData = buf.getChannelData(0);
				this.duration = buf.duration;

				const blockSize = Math.floor(rawData.length / this.nSamples);
				for (let i = 0; i < this.nSamples; i++) {
					let blockStart = blockSize * i;
					let sum = 0;
					for (let j = 0; j < blockSize; j++) {
						sum += Math.abs(rawData[blockStart + j]);
					}
					tempArray.push(sum / blockSize);
				}

				let maxval = Math.max(...tempArray);
				this.filteredData = tempArray.map((x) => x / maxval);
				this.saveCache();
			});
		},
		barMouseDownHandler(i: number) {
			this.clickCount += 1;
			setTimeout(() => {
				this.clickCount = 0;
			}, 200);

			let time = (i / this.nSamples) * this.duration;
			this.setPlayheadSecs(time);
		},
		playComment(comment: string) {
			const targetComment = this.comments.find(
				(c: AudioComment) => c.content === comment
			);
			if (targetComment) {
				this.playFrom(targetComment.timeNumber);
			}
		},
		playFrom(time: any) {
			this.setPlayheadSecs(time);
			this.play();
		},
		setPlayheadSecs(time: any) {
			this.currentTime = time;
			if (!this.isCurrent()) this.togglePlay();

			if (this.isCurrent()) {
				this.audio.currentTime = time;
			}
		},
		togglePlay() {
			if (!this.isCurrent()) {
				this.audio.src = this.srcPath;
			}

			if (this.audio.paused) {
				this.globalPause();
				this.play();
			} else {
				this.pause();
			}
		},
		play() {
			if (this.currentTime > 0) {
				this.audio.currentTime = this.currentTime;
			}
			this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
			this.audio.play();
			this.playing = true;
			this.setBtnIcon("pause");
		},
		pause() {
			this.audio.pause();
			this.playing = false;
			this.setBtnIcon("play");
		},
		globalPause() {
			this.playing = false;
			const ev = new Event("allpause");
			document.dispatchEvent(ev);
		},
		timeUpdateHandler() {
			if (this.isCurrent()) {
				this.currentTime = this.audio?.currentTime;

				const nextComment = this.commentsSorted.filter(
					(x: AudioComment) => this.audio?.currentTime >= x.timeNumber
				);

				if (nextComment.length == 1) {
					this.activeComment = nextComment[0];
				}
				if (nextComment.length > 1) {
					this.activeComment = nextComment[nextComment.length - 1];
				}
			}
		},
		setBtnIcon(icon: string) {
			if (this.button) {
				setIcon(this.button, icon);
			}
		},
		playCommentListener(e: CustomEvent<AudioPlayCommentEventPayload>) {
			if (!e.detail.playerId || !e.detail.comment) return;

			if (this.playerId === e.detail.playerId) {
				this.playComment(e.detail.comment);
			}
		},
		allResumeListener() {
			if (this.isCurrent()) this.setBtnIcon("pause");
		},
		allPauseListener() {
			this.audio.pause();
			this.playing = false;
			this.setBtnIcon("play");
		},
		audioEndedListener() {
			if (this.audio.src === this.srcPath) {
				this.setBtnIcon("play");
				this.audio.pause();
				this.playing = false;
			}
		},
	},
	created() {
		this.loadFile();
	},
	mounted() {
		this.button = this.$refs.playpause as HTMLSpanElement;
		this.setBtnIcon("play");

		document.addEventListener(
			PlayCommentCommand,
			this.playCommentListener as EventListener
		);
		document.addEventListener("allpause", this.allPauseListener);
		document.addEventListener("allresume", this.allResumeListener);

		this.audio.addEventListener("ended", this.audioEndedListener);

		this.$el.addEventListener("resize", () => {
			console.log(this.$el.clientWidth);
		});
		// get current time
		if (this.audio.src === this.srcPath) {
			this.currentTime = this.audio.currentTime;
			this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
			this.setBtnIcon(this.audio.paused ? "play" : "pause");
		}
	},
	beforeUnmount() {
		this.audio.removeEventListener("ended", this.audioEndedListener);
		this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
		document.removeEventListener("allpause", this.allPauseListener);
		document.removeEventListener("allresume", this.allResumeListener);
		document.removeEventListener(
			PlayCommentCommand,
			this.playCommentListener as EventListener
		);
	},
	beforeDestroy() {},
});
</script>
