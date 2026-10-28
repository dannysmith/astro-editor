import type {
	AppBskyEmbedExternal,
	AppBskyEmbedImages,
	AppBskyEmbedRecord,
	AppBskyEmbedRecordWithMedia,
	AppBskyEmbedVideo,
	AppBskyFeedDefs,
	AppBskyFeedPost,
} from '@atcute/bluesky';

export interface Post extends AppBskyFeedDefs.PostView {
	record: AppBskyFeedPost.Main;
}

export type EmbedView =
	| AppBskyEmbedRecord.View
	| AppBskyEmbedImages.View
	| AppBskyEmbedVideo.View
	| AppBskyEmbedExternal.View
	| AppBskyEmbedRecordWithMedia.View
	| { [k: string]: unknown; $type: string };
