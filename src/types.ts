export type AudioChapter = {
	from: number;
	till: number;
};

export type AudioComment = {
	content: string;
	timeNumber: number;
	timeString: string;
	index: number;
};

export type AudioPlayerRendererOptions = {
	comments: Array<AudioComment>;
	player: HTMLAudioElement;
	filepath: string;
	type: "small" | "default";
	chapter?: AudioChapter;
	title?: string;
};

export type AudioPlayCommentEventPayload = {
	playerId: string;
	comment: string;
};

export const PlayCommentCommand = "audioplaycomment";
