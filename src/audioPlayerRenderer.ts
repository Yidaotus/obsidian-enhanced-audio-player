import { MarkdownRenderChild } from "obsidian";

import { App, createApp } from "vue";
import VueApp from "./components/App.vue";
import { AudioPlayerRendererOptions } from "./types";

export class AudioPlayerRenderer extends MarkdownRenderChild {
	options: AudioPlayerRendererOptions;
	vueApp: App<Element>;

	constructor(containerEl: HTMLElement, options: AudioPlayerRendererOptions) {
		super(containerEl);
		this.options = options;
		this.vueApp = createApp(VueApp, {
			filepath: this.options.filepath,
			comments: this.options.comments,
			audio: this.options.player,
			type: this.options.type || "default",
			chapter: this.options.chapter,
			title: this.options.title,
		});
	}

	onload(): void {
		this.vueApp.mount(this.containerEl);
	}

	onunload(): void {
		this.vueApp.unmount();
	}
}
