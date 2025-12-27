async function getpresignedurl(filename) {
    const res=await fetch("https://isatafileze.fly.dev/generate-download-url", {
                    "headers": {
                        "accept": "*/*",
                        "accept-language": "en-US,en;q=0.9",
                        "content-type": "application/json",
                        "priority": "u=1, i",
                        "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": "\"Windows\"",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "cross-site",
                        "Referer": "https://isatafilez.my/"
                    },
                    "body": JSON.stringify({filename}) ,
                    "method": "POST"
                    });
       const data= await res.json();
       console.log(data);
}

getpresignedurl('Serie/EXIT_PROTOCOL.mp4')