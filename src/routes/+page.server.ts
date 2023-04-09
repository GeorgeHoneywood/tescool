import type { Cookies } from '@sveltejs/kit';
import {
    getTescoPage,
    getLocalTodayString,
    log,
    randomIntFromInterval,
    addImageUrls,
    type Item,
} from '../util';

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
let dailyDataPromise: Promise<any> | null = null;
let dataDate = "1970-1-1" // doesn't matter, just needs to be any date initially

let randomData: any = null;
let randomDataPromise: Promise<any> | null = null;
let randomDataTime: number | null = null;

// we have to do this because the tesco api is not CORS enabled,
// so we have to request it from the server
export async function load({ cookies, getClientAddress, request }) {
    // if request timezone is unavailable, should instead default to server
    // timezone, which is probably fairly close to the user's timezone (in cf
    // workers)
    const timeZone = (request as any).cf?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    log(`using timezone: ${timeZone}`, getClientAddress())

    return { streamed: { tesco: getItems(cookies, timeZone) }, loadDate: getLocalTodayString(timeZone) };

    async function getItems(cookies: Cookies, timeZone: string): Promise<TescoResponse> {
        // if the daily challenge for today has been completed, we can return random items
        if (cookies.get("dailyChallengeDate") === getLocalTodayString(timeZone)) {
            log(`returning random page`, getClientAddress())

            // wait for any inflight requests to finish
            await randomDataPromise;

            // if we don't have any data, or, data is too old
            if (!randomData || !randomDataTime || ((Date.now() - randomDataTime) > (15 * 1000))) {
                const page = randomIntFromInterval(0, MAX_PAGE)

                log(`fetching random page: ${page}`, getClientAddress())

                randomDataPromise = getTescoPage(page, getClientAddress());

                randomDataTime = Date.now()
                randomData = await randomDataPromise;
            } else {
                log(`reusing random data from ${(Date.now() - randomDataTime) / 1000}s ago`, getClientAddress())
            }

            const pageSize = randomData.productsByCategory.data.results.pageInformation.pageSize;
            const start = randomIntFromInterval(0, pageSize - 6)
            return {
                type: "random",
                items: addImageUrls(randomData).slice(start, start + 5)
            };
        } else {
            log(`returning daily challenge`, getClientAddress())
            const today = getLocalTodayString(timeZone);
            const outdated = today !== dataDate

            // if we are already fetching, just wait
            await dailyDataPromise;

            if (dailyData === null || outdated) {
                log(`daily data is outdated, reloading (date was: ${dataDate}, now is ${today})`, getClientAddress())

                const now = new Date(new Date().toLocaleString("en-US", { timeZone: timeZone }))
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
                log(`loading daily page: ${page}`, getClientAddress())

                dailyDataPromise = getTescoPage(page, getClientAddress());
                dailyData = await dailyDataPromise;
                dataDate = getLocalTodayString(timeZone); // FIXME: some sort of race condition here? (probably not important)
            }

            return {
                type: "daily",
                items: addImageUrls(dailyData).slice(0, 5)
            };
        }
    }
}

