<template>
	<div class="comment">
		<span class="timestamp" @click="emitMovePlayhead">{{
			cmt.timeString
		}}</span>
		<span class="content" @click="playFrom">{{ cmt.content }}</span>
	</div>
</template>

<script lang="ts">
import { AudioComment } from "../types";
import { defineComponent, PropType } from "vue";
import { setIcon } from "obsidian";

export default defineComponent({
	name: "AudioComment",
	props: {
		cmt: {
			type: Object as PropType<AudioComment>,
			required: true,
		},
	},
	methods: {
		playFrom() {
			this.$emit("play-from", this.cmt.timeNumber);
		},
		emitMovePlayhead() {
			this.$emit("move-playhead", this.cmt.timeNumber);
		},
	},
});
</script>
