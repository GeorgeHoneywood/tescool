import { error } from '@sveltejs/kit';

// credit to: https://stackoverflow.com/a/7228322
function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export type Item = {
    title: string;
    price: number;
    defaultImageUrl: string;
}

const MAX_PAGE = 150; // assuming 150 pages at least (there are currently ~250)

// cache data in daily mode
// TODO: this probably won't work very well if we are running in cloudflare
// workers, maybe we should use the cache api instead?
// this would have the bonus of being transparent to the calling code
let data: any = null; 
let dataDate = new Date("2021-01-01"); // doesn't matter, just needs to be any date initially

// we have to do this because the tesco api is not CORS enabled,
// so we have to request it from the server
export async function load() {
    return { streamed: { items: getItems() } };

    async function getItems() {
        const now = new Date();
        const outdated = now.getDay() !== dataDate.getDay()

        if (data === null || outdated) {
            console.log("data is outdated, reloading");
            // const page = randomIntFromInterval(0, MAX_PAGE) 
            
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

            const resp = await fetch("https://www.tesco.com/groceries/en-GB/resources", {
                "headers": {
                    "Accept": "application/json",
                    "content-type": "application/json",
                    "x-csrf-token": "fkQYjp05-cqNoNNSA04MVNkl3Q4ZD4RVfCPw",
                    "cookie": "_csrf=C4kyhDX5wl99qeq-5NBN2xyt",
                    // have to use a fake user agent, otherwise the request is hangs forever
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
                },
                "body": JSON.stringify({
                    "resources": [
                        {
                            "type": "productsByCategory",
                            "params": {
                                "query": {
                                    "page": page,
                                },
                                "superdepartment": "food-cupboard"
                            },
                        },
                    ],
                }),
                "method": "POST",
            });

            data = await resp.json();

            if (!data.productsByCategory) {
                console.log("failed to load data, instead got: ", data, resp);
                throw error(500, {
                    message: 'could not load data from tesco'
                });
            }

            dataDate = new Date(); // FIXME: some sort of race condition here? (probably not important)
        }

        // const pageSize = data.productsByCategory.data.results.pageInformation.pageSize;

        // const start = Math.min(
        //     randomIntFromInterval(0, pageSize - 1),
        //     pageSize - 6
        // );
        const start = 0;

        return data.productsByCategory.data.results.productItems.map(
            (e: any) => e.product
        ).slice(start, start + 5) as Item[];
    }
}