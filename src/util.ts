import { error } from "@sveltejs/kit";

// should return something like 2023-04-08
const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

// credit to: https://stackoverflow.com/a/7228322
function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

async function getTescoPage(page: number): Promise<any> {
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
    return data
}

function log(message: string, ip: string) {
    console.log(`${ip}: ${message}`)
}

export {
    getTodayString,
    getTescoPage,
    randomIntFromInterval,
    log,
}