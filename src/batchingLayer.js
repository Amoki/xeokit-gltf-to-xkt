import {math} from "./math.js";

var quantizePositions = (function () { // http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
    const translate = math.mat4();
    const scale = math.mat4();
    return function (positions, lenPositions, aabb, quantizedPositions, positionsDecodeMatrix) {
        const xmin = aabb[0];
        const ymin = aabb[1];
        const zmin = aabb[2];
        const xwid = aabb[3] - xmin;
        const ywid = aabb[4] - ymin;
        const zwid = aabb[5] - zmin;
        // const maxInt = 2000000;
        const maxInt = 65525;
        const xMultiplier = maxInt / xwid;
        const yMultiplier = maxInt / ywid;
        const zMultiplier = maxInt / zwid;
        let i;
        for (i = 0; i < lenPositions; i += 3) {
            quantizedPositions[i + 0] = Math.floor((positions[i + 0] - xmin) * xMultiplier);
            quantizedPositions[i + 1] = Math.floor((positions[i + 1] - ymin) * yMultiplier);
            quantizedPositions[i + 2] = Math.floor((positions[i + 2] - zmin) * zMultiplier);
        }
        math.identityMat4(translate);
        math.translationMat4v(aabb, translate);
        math.identityMat4(scale);
        math.scalingMat4v([xwid / maxInt, ywid / maxInt, zwid / maxInt], scale);
        math.mulMat4(translate, scale, positionsDecodeMatrix);
    };
})();

function transformAndOctEncodeNormals(modelNormalMatrix, normals, lenNormals, compressedNormals, lenCompressedNormals) {
    // http://jcgt.org/published/0003/02/01/
    let oct, dec, best, currentCos, bestCos;
    let i, ei;
    let localNormal = new Float32Array([0, 0, 0, 0]);
    let worldNormal = new Float32Array([0, 0, 0, 0]);
    for (i = 0; i < lenNormals; i += 3) {
        localNormal[0] = normals[i];
        localNormal[1] = normals[i + 1];
        localNormal[2] = normals[i + 2];

        math.transformVec3(modelNormalMatrix, localNormal, worldNormal);
        math.normalizeVec3(worldNormal, worldNormal);

        // Test various combinations of ceil and floor to minimize rounding errors
        best = oct = octEncodeVec3(worldNormal, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(worldNormal, dec);
        oct = octEncodeVec3(worldNormal, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(worldNormal, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(worldNormal, "ceil", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(worldNormal, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        compressedNormals[lenCompressedNormals + i + 0] = best[0];
        compressedNormals[lenCompressedNormals + i + 1] = best[1];
        compressedNormals[lenCompressedNormals + i + 2] = 0.0; // Unused
    }
    lenCompressedNormals += lenNormals;
    return lenCompressedNormals;
}

function octEncodeVec3(p, xfunc, yfunc) { // Oct-encode single normal vector in 2 bytes
    let x = p[0] / (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]));
    let y = p[1] / (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]));
    if (p[2] < 0) {
        let tempx = x;
        let tempy = y;
        tempx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        tempy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        x = tempx;
        y = tempy;
    }
    return new Int8Array([
        Math[xfunc](x * 127.5 + (x < 0 ? -1 : 0)),
        Math[yfunc](y * 127.5 + (y < 0 ? -1 : 0))
    ]);
}

function octDecodeVec2(oct) { // Decode an oct-encoded normal
    let x = oct[0];
    let y = oct[1];
    x /= x < 0 ? 127 : 128;
    y /= y < 0 ? 127 : 128;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
        x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
        y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
    }
    const length = Math.sqrt(x * x + y * y + z * z);
    return [
        x / length,
        y / length,
        z / length
    ];
}

function dot(p, vec3) { // Dot product of a normal in an array against a candidate decoding
    return p[0] * vec3[0] + p[1] * vec3[1] + p[2] * vec3[2];
}

export {quantizePositions, transformAndOctEncodeNormals};