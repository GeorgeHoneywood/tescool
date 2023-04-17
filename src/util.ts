import { error } from "@sveltejs/kit";
export type Item = {
    title: string;
    price: number;
    x1ImageUrl: string;
    x2ImageUrl: string;
}

// should return something like 2023-4-8
const getLocalTodayString = (timeZone: string | null = null) => {
    let today = new Date(new Date().toLocaleString("en-US"));
    if (timeZone) {
        today = new Date(new Date().toLocaleString("en-US", { timeZone: timeZone }));
    }

    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

// credit to: https://stackoverflow.com/a/7228322
function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

async function getTescoItems(page: number, offset: number, clientAddress: string): Promise<Item[]> {
    log("making tesco API request", clientAddress)
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
    log("tesco API request finished", clientAddress)

    const data = await resp.json() as any;

    if (!data.productsByCategory) {
        console.log("failed to load data, instead got: ", data, resp);
        throw error(500, {
            message: 'could not load data from tesco'
        });
    }

    return data.productsByCategory.data.results.productItems.map(
        (e: any) => {
            const x1ImageUrl = new URL(e.product.defaultImageUrl)
            x1ImageUrl.searchParams.set("h", "250")
            x1ImageUrl.searchParams.set("w", "250")

            const x2ImageUrl = new URL(e.product.defaultImageUrl)
            x2ImageUrl.searchParams.set("h", "500")
            x2ImageUrl.searchParams.set("w", "500")

            return {
                title: e.product.title,
                price: e.product.price,
                x1ImageUrl: x1ImageUrl.toString(),
                x2ImageUrl: x2ImageUrl.toString(),
            }
        }).slice(offset, offset + 5);
}

function log(message: string, ip: string) {
    console.log(`${ip}: ${message}`)
}

export {
    getLocalTodayString,
    getTescoItems,
    randomIntFromInterval,
    log,
}