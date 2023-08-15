export type AudioComment = {
	content: string;
	timeNumber: number;
	timeString: string;
	index: number;
};

export type AudioPlayerRendererOptions = {
	playerId: string;
	comments: Array<AudioComment>;
	player: HTMLAudioElement;
	filepath: string;
};

export type AudioPlayCommentEventPayload = {
	playerId: string;
	comment: string;
};

export const PlayCommentCommand = "audioplaycomment";
