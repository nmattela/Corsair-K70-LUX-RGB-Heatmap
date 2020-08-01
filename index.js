const { OpenRGBClient } = require('./openrgb');
const ioHook = require('iohook');
const fs = require('fs');

function fromEntries(arr) {
    const res = {};

    arr.forEach(([key, value]) => {
        if(res[key] === undefined)
            res[key] = value
    });

    return res;
}

function HSVtoRGB(h, s, v) {
    let r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        red: Math.round(r * 255),
        green: Math.round(g * 255),
        blue: Math.round(b * 255)
    };
}

const connectClient = async () => {
    try {
        const client = new OpenRGBClient({
            host: 'localhost',
            port: 6742,
            name: "Heatmap"
        });
        await client.connect();
        return client
    } catch (e) {
        return await connectClient()
    }
}

const main = async () => {

    const config = JSON.parse(fs.readFileSync('./config.json'));

    const client = await connectClient();
    const controllerCount = await client.getControllerCount();

    let k70;
    for(let deviceId = 0; deviceId < controllerCount; deviceId++) {
        const device = await client.getDeviceController(deviceId);
        console.log(device)
        if(device.name === 'Corsair K70 LUX RGB') {
            k70 = device
        }
    }
    if(k70 === undefined) {
        console.error("K70 Not plugged in!")
    } else {
        const colors = Array(k70.colors.length).fill({
            red: 0xFF,
            green: 0x00,
            blue: 0x00
        });

        await client.updateLeds(k70, colors);
        console.log("Client connected");

        const keys = fromEntries(
            Object.entries(config)
                .map(([key, value]) =>
                    [key, {
                        name: value,
                        index: k70.leds.findIndex(led => led.name === value),
                        presses: 0
                    }]
                )
        );
        ioHook.on("keyup", async event => {
            const key = keys[event.keycode];
            if(key) {
                key.presses++;
                const keyPresses = Object.values(keys)
                    .sort((a, b) => a.index < b.index ? -1 : 1)
                    .map((value) => value.presses);
                const totalPresses = keyPresses.reduce((acc, val) => acc + val);
                const maxPresses = keyPresses.reduce((a, b) => Math.max(a, b));
                const newRGBs = keyPresses
                    .map(presses => HSVtoRGB(((presses / totalPresses) * (30/36)), 1, 1));
                await client.updateLeds(k70, newRGBs)
            }
        });

        ioHook.start()
    }
};

main();