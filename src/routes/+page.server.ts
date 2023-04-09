import type { Cookies } from '@sveltejs/kit';
import {
    getTescoPage,
    getTodayString,
    randomIntFromInterval,
} from '../util';

export type Item = {
    title: string;
    price: number;
    defaultImageUrl: string;
}

type TescoResponse = {
    items: Item[];
    type: "daily" | "random";
}

const MAX_PAGE = 150; // assuming 150 pages at least (there are currently ~250)

// cache data in daily mode
// TODO: this probably won't work very well if we are running in cloudflare
// workers, maybe we should use the cache api instead?
// this would have the bonus of being transparent to the calling code
let dailyData: any = null;
let dataDate = getTodayString(); // doesn't matter, just needs to be any date initially

// we have to do this because the tesco api is not CORS enabled,
// so we have to request it from the server
export async function load({ cookies }) {
    return { streamed: { tesco: getItems(cookies) }, loadDate: getTodayString() };

    async function getItems(cookies: Cookies): Promise<TescoResponse> {
        // if the daily challenge for today has been completed, we can return random items
        if (cookies.get("dailyChallengeDate") === getTodayString()) {
            const page = randomIntFromInterval(0, MAX_PAGE)

            console.log("daily challenge completed, returning random page", page);

            const randomData = await getTescoPage(page);
            const pageSize = randomData.productsByCategory.data.results.pageInformation.pageSize;
            const start = randomIntFromInterval(0, pageSize - 6)

            return {
                type: "random",
                items: randomData.productsByCategory.data.results.productItems.map(
                    (e: any) => e.product
                ).slice(start, start + 5) as Item[]
            };
        } else {
            // otherwise we return the daily challenge items
            const today = getTodayString();
            const outdated = today !== dataDate

            if (dailyData === null || outdated) {
                console.log("data is outdated, reloading");

                const now = new Date();
                // FIXME: this is a hack, as we skip some pages if months do not
                // have 31 days
                const approxDayOfYear = (now.getDate() + now.getMonth()) * 31
                const wrappedDate = (approxDayOfYear % MAX_PAGE)
                // this should produce a consistent page per day,
                // with a pattern something like this:
                // [1, 150, 2, 149, 3, 148]
                // hopefully this should help similar items showing up on the next
                // day
                // TODO: just use a proper prng instead, with the date as seed, this
                // will ensure that we don't have this problem
                const page = approxDayOfYear % 2 === 0 ? wrappedDate : MAX_PAGE - wrappedDate;
                console.log("loading page", page)

                dailyData = await getTescoPage(page);
                dataDate = getTodayString(); // FIXME: some sort of race condition here? (probably not important)
            }

            return {
                type: "daily",
                items: dailyData.productsByCategory.data.results.productItems.map(
                    (e: any) => e.product
                ).slice(0, 5) as Item[]
            };
        }
    }
}

