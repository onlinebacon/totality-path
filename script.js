const { PI, sqrt } = Math;

const radToDeg = (rad) => rad*(180/PI);
const degToRad = (deg) => deg*(PI/180);
const sin = (deg) => Math.sin(degToRad(deg));
const cos = (deg) => Math.cos(degToRad(deg));
const tan = (deg) => Math.tan(degToRad(deg));
const asin = (sin) => radToDeg(Math.asin(sin));
const acos = (cos) => radToDeg(Math.acos(cos));
const dot = ([ ax, ay, az ], [ bx, by, bz ]) => ax*bx + ay*by + az*bz;
const scale = ([ x, y, z ], val) => [ x*val, y*val, z*val ];
const plus = ([ ax, ay, az ], [ bx, by, bz ]) => [ ax + bx, ay + by, az + bz ];
const minus = ([ ax, ay, az ], [ bx, by, bz ]) => [ ax - bx, ay - by, az - bz ];
const len = ([ x, y, z ]) => sqrt(x**2 + y**2 + z**2);
const normalize = (vec) => scale(vec, 1/len(vec));

const vecToLatLon = (vec) => {
    const [ nx, ny, nz ] = normalize(vec);
    const lat = asin(ny);
    const len = sqrt(nx**2 + nz**2);
    const abs = acos(nz/len);
    const lon = nx >= 0 ? abs : -abs;
    return [ lat, lon ];
};

const parseAngle = (angle) => {
    let [ deg, min ] = angle.replace(/[°'\s]+/g, '\x20').trim().split(' ').map(Number);
    return deg < 0 ? deg - min/60 : deg + min/60;
};

const parseValue = (val) => val.includes('°') ? parseAngle(val) : Number(val);

const parseTable = (table) => {
    return table
        .trim()
        .split(/\n/)
        .map(line => line.trim())
        .map(line => line.split(/\|/).map(parseValue));
};

const earthRadius = 6371;
const sunDist = 150000000;

const sunGhaDecTable = parseTable(`
    16 |  63° 29.7' | -8° 12.8'
    17 |  78° 29.9' | -8° 13.7'
    18 |  93° 30.0' | -8° 14.6'
    19 | 108° 30.3' | -8° 15.5'
    20 | 123° 30.5' | -8° 16.5'
`);

const moonGhaDecTable = parseTable(`
    16 |  64° 10.7' | -7° 28.0'
    17 |  78° 45.5' | -7° 42.2'
    18 |  93° 20.1' | -7° 56.4'
    19 | 107° 54.7' | -8° 10.6'
    20 | 122° 29.3' | -8° 24.8'
`);

const moonHPTable = parseTable(`
    14.5 | 0° 55.1'
    20.5 | 0° 55.2'
`);

const rayEarthIntersection = (moonPos, shadowDir) => {
    const v = scale(moonPos, -1);
    const t = dot(v, shadowDir);
    const p = plus(moonPos, scale(shadowDir, t));
    const y = len(p);
    if (y > earthRadius) {
        return null;
    }
    const x = sqrt(earthRadius**2 - y**2);
    const i = plus(moonPos, scale(shadowDir, t - x));
    return vecToLatLon(i);
};

const interpolate = (table, hour) => {
    for (let i=1; i<table.length; ++i) {
        const [h0] = table[i - 1];
        const [h1] = table[i];
        if (hour < h0) {
            break;
        }
        if (hour > h1) {
            continue;
        }
        const t = (hour - h0)/(h1 - h0);
        const v0 = table[i - 1].slice(1);
        const v1 = table[i].slice(1);
        return v0.map((a, i) => {
            const b = v1[i];
            return a + (b - a)*t;
        });
    }
    throw new Error('Hour outside of table range');
};

const getMoonDist = (hour) => {
    const [ hp ] = interpolate(moonHPTable, hour);
    return earthRadius/tan(hp);
};

const ghaDecToLatLon = ([ gha, dec ]) => {
    const lon = (360 + 180 - gha)%360 - 180;
    const lat = dec;
    return [ lat, lon ];
};

const latLonToVecPos = ([ lat, lon ], dist) => {
    return [
        sin(lon)*cos(lat)*dist,
        sin(lat)*dist,
        cos(lon)*cos(lat)*dist,
    ];
};

const getVecPos = (posTable, dist, hour) => {
    const ghaDec = interpolate(posTable, hour);
    const gp = ghaDecToLatLon(ghaDec);
    const vec = latLonToVecPos(gp, dist);
    return vec;
};

const getTotalCoord = (hour) => {
    const sunPos = getVecPos(sunGhaDecTable, sunDist, hour);
    const moonDist = getMoonDist(hour);
    const moonPos = getVecPos(moonGhaDecTable, moonDist, hour);
    const shadowDir = normalize(minus(moonPos, sunPos));
    const coord = rayEarthIntersection(moonPos, shadowDir);
    return coord;
};

const coords = [];

const latLonToXY = (lat, lon) => {
    const x = (0.5 + lon/360)*canvas.width;
    const y = (0.5 - lat/180)*canvas.height;
    return [ x, y ];
};

const img = document.querySelector('img');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

ctx.lineWidth = 3;

img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#0bf';
    let first = true;
    for (let hour=16; hour<=20; hour += 1/500) {
        const coord = getTotalCoord(hour);
        if (coord !== null) {
            const [ lat, lon ] = coord;
            const [ x, y ] = latLonToXY(lat, lon);
            if (first) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            first = false;
        }
    }
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 8.3px arial';
    for (let hour=16; hour<=20; hour+=10/60) {
        const coord = getTotalCoord(hour);
        if (coord !== null) {
            const [ lat, lon ] = coord;
            const [ x, y ] = latLonToXY(lat, lon);
            const h = Math.floor(hour);
            const m = Math.round((hour - h)*60);
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillText(`${h}:${m.toString().padStart(2, 0)}`, x, y);
        }
    }
};
