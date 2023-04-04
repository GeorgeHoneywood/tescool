// credit to: https://stackoverflow.com/a/7228322
function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export async function load({ params }) {
    const resp = await fetch("https://www.tesco.com/groceries/en-GB/resources", {
        "headers": {
            "Accept": "application/json",
            "content-type": "application/json",
            "x-csrf-token": "fkQYjp05-cqNoNNSA04MVNkl3Q4ZD4RVfCPw",
            "cookie": "_csrf=C4kyhDX5wl99qeq-5NBN2xyt"
        },
        "body": JSON.stringify({
            "resources": [
                {
                    "type": "productsByCategory",
                    "params": {
                        "query": {
                            "page": randomIntFromInterval(0, 100) // assuming 100 pages at least (there are currently ~250)
                        },
                        "superdepartment": "food-cupboard"
                    }
                }
            ],
        }),
        "method": "POST",
    });

    const data = await resp.json()
    console.log({resp, data, fetch})
    const pageSize = data.productsByCategory.data.results.pageInformation.pageSize;

    const start = Math.min(
        randomIntFromInterval(0, pageSize - 1),
        pageSize - 6,
    )

    const items = data.productsByCategory.data.results.productItems.map(
        (e: any) => e.product
    ).slice(start, start + 5)

    return { items };
}