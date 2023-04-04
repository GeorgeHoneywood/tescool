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

// we have to do this because the tesco api is not CORS enabled
export async function load() {
    return { streamed: { items: getItems() } };

    async function getItems() {
        const page = randomIntFromInterval(0, 100) // assuming 100 pages at least (there are currently ~250)

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

        const data = await resp.json();

        if (!data.productsByCategory) {
            console.log("failed to load data, instead got: ", data, resp);
            throw error(500, {
                message: 'could not load data from tesco'
            });
        }

        const pageSize = data.productsByCategory.data.results.pageInformation.pageSize;

        const start = Math.min(
            randomIntFromInterval(0, pageSize - 1),
            pageSize - 6
        );

        return data.productsByCategory.data.results.productItems.map(
            (e: any) => e.product
        ).slice(start, start + 5) as Item[];
    }
}