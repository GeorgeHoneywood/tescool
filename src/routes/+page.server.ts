import type { Cookies } from '@sveltejs/kit';
import {
    getTescoItems,
    getLocalTodayString,
    log,
    randomIntFromInterval,
    type Item,
} from '../util';

import {
    hashCyrb128,
    randomMulberry32,
} from '../rand';

type TescoResponse = {
    items: Item[];
    type: "daily" | "random";
}

const MAX_PAGE = 150; // assuming 150 pages at least (there are currently ~250)
const PAGE_SIZE = 24; // 24 items per page

// cache data in daily mode
// TODO: this probably won't work very well if we are running in cloudflare
// workers, maybe we should use the cache api instead?
// this would have the bonus of being transparent to the calling code
const dailyDataCache: { [date: string]: Promise<Item[] | null> | Item[] | null } = {};

let randomData: Item[] | null = null;
let randomDataPromise: Promise<Item[]> | null = null;
let randomDataTime: number | null = null;

// we have to do this because the tesco api is not CORS enabled,
// so we have to request it from the server
export async function load({ cookies, getClientAddress, request, platform }) {
    const kv = platform?.env?.DAILY_CHALLENGE

    // if request timezone is unavailable, should instead default to server
    // timezone, which is probably fairly close to the user's timezone (in cf
    // workers)
    const timeZone = (request as any).cf?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    log(`using timezone: ${timeZone}`, getClientAddress())

    return { streamed: { tesco: getItems(cookies, timeZone, kv) }, loadDate: getLocalTodayString(timeZone) };

    async function getItems(cookies: Cookies, timeZone: string, kv: KVNamespace | undefined): Promise<TescoResponse> {
        // if the daily challenge for today has been completed, we can return random items
        if (cookies.get("dailyChallengeDate") === getLocalTodayString(timeZone)) {
            log(`returning random page`, getClientAddress())

            // wait for any inflight requests to finish
            await randomDataPromise;

            // if we don't have any data, or, data is too old
            if (!randomData || !randomDataTime || ((Date.now() - randomDataTime) > (15 * 1000))) {
                const page = randomIntFromInterval(0, MAX_PAGE)

                log(`fetching random page: ${page}`, getClientAddress())

                randomDataPromise = getTescoItems(page, randomIntFromInterval(0, PAGE_SIZE), getClientAddress());

                randomDataTime = Date.now()
                randomData = await randomDataPromise;
            } else {
                log(`reusing random data from ${(Date.now() - randomDataTime) / 1000}s ago`, getClientAddress())
            }

            return {
                type: "random",
                items: randomData
            };
        } else {
            log(`returning daily challenge`, getClientAddress())
            const today = getLocalTodayString(timeZone);

            // if we are already fetching, just wait
            await dailyDataCache[today];

            if (!dailyDataCache[today]) {
                log(`daily data is not locally cached`, getClientAddress())

                // if we have a kv store, try to get the data from there, else fetch it
                if (kv !== undefined) {
                    // first try to get the page from the kv store
                    log(`attempting to retrieve data from kv`, getClientAddress())
                    dailyDataCache[today] = kv.get<Item[]>(today, "json");
                    dailyDataCache[today] = await dailyDataCache[today];
                    log(dailyDataCache[today] ? `got daily data from kv` : `couldn't get daily data from kv`, getClientAddress())

                    if (!dailyDataCache[today]) {
                        await getDailyPage(timeZone, getClientAddress, today);

                        log(`saving daily data to kv`, getClientAddress())
                        // save the data to the kv store, asynchronously
                        kv.put(today, JSON.stringify(dailyDataCache[today]), {
                            expirationTtl: 60 * 60 * 48, // seconds (should expire in 2 days)
                        }).catch((e) => {
                            log(`failed to save daily data to kv: ${e}`, getClientAddress())
                        });
                    }
                } else {
                    await getDailyPage(timeZone, getClientAddress, today);
                }
            }

            return {
                type: "daily",
                items: await dailyDataCache[today] ?? [] // this will have already been awaited above, so should be a no-op
            };
        }
    }
}

async function getDailyPage(timeZone: string, getClientAddress: any, today: string) {
    const seed = hashCyrb128(getLocalTodayString(timeZone));
    const rand = randomMulberry32(seed);
    const page = Math.floor(rand() * MAX_PAGE);
    const offset = Math.floor(rand() * (PAGE_SIZE - 5));

    log(`loading daily page: ${page}:${offset}`, getClientAddress());

    dailyDataCache[today] = getTescoItems(page, offset, getClientAddress());
    dailyDataCache[today] = await dailyDataCache[today];
}


