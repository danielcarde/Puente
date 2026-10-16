import { createChatHandler } from '../server/chat.mjs';
const chat = createChatHandler();
export default {fetch: chat};
