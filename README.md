# [Tescool](https://tescool.pages.dev)

[Tescool](https://tescool.pages.dev) is a little grocery price guessing game, for Tesco items. It's become a little harder with the recent inflation.

It has a daily challenge mode, where you can share your score with others, and a free play mode.

https://github.com/GeorgeHoneywood/tescool/assets/25514836/ee60facd-9b81-4e3d-ba46-0a327359427e

## Tech

Tescool is built with SvelteKit and Vite, and is hosted on Cloudflare Pages. The daily data is fetched on the first request of the day, and is persisted in Cloudflare Workers KV. Free play data is fetched on demand, and is cached for 15 seconds. 

Tesco previously had a public API, but it seems to have been shut down at some point — conveniently, their website has an unauthenticated API that can be used for getting product information. Unfortunately, when you fetch a page of products, you _sometimes_ get similar products being listed next to each other (i.e. different flavours of Pringles). This could be worked around with a bit of further effort.
