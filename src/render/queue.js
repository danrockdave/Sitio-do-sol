/**
 * Render queue with automatic instancing.
 *
 * Game code submits "draw this model with this matrix" every frame. The
 * queue groups submissions per model part, so N copies of a fence or a crop
 * become a single instanced draw call per material.
 *
 * Animated models submit a pose: a map partName -> local matrix that is
 * multiplied with the model matrix (e.g. swinging legs, spinning blades).
 */

import { mat4 } from '../../lib/gl-matrix/index.js';
import { INSTANCE_FLOATS } from '../gl/mesh.js';

const WHITE = [1, 1, 1, 1];

export class RenderQueue {
  constructor() {
    this.batches = new Map();   // part object -> batch
    this.order = [];
    this._tmp = mat4.create();
  }

  clear() {
    for (const batch of this.order) batch.count = 0;
  }

  /** Whole model, one matrix. */
  add(model, matrix, tint = WHITE) {
    if (!model) return;
    for (const part of model.parts) this._push(model, part, matrix, tint);
  }

  /** Model whose named parts get an extra local transform (pose[partName]). */
  addPosed(model, matrix, pose, tint = WHITE) {
    if (!model) return;
    for (const part of model.parts) {
      const local = pose && pose[part.name];
      if (local) {
        mat4.multiply(this._tmp, matrix, local);
        this._push(model, part, this._tmp, tint);
      } else {
        this._push(model, part, matrix, tint);
      }
    }
  }

  /** Only some parts of a model (e.g. hide the blades of a windmill). */
  addParts(model, matrix, partNames, tint = WHITE) {
    if (!model) return;
    for (const part of model.parts) {
      if (partNames.includes(part.name)) this._push(model, part, matrix, tint);
    }
  }

  _push(model, part, matrix, tint) {
    let batch = this.batches.get(part);
    if (!batch) {
      batch = { model, part, data: new Float32Array(INSTANCE_FLOATS * 16), count: 0, offset: 0 };
      this.batches.set(part, batch);
      this.order.push(batch);
    }
    if ((batch.count + 1) * INSTANCE_FLOATS > batch.data.length) {
      const grown = new Float32Array(batch.data.length * 2);
      grown.set(batch.data);
      batch.data = grown;
    }
    const o = batch.count * INSTANCE_FLOATS;
    batch.data.set(matrix, o);
    batch.data[o + 16] = tint[0];
    batch.data[o + 17] = tint[1];
    batch.data[o + 18] = tint[2];
    batch.data[o + 19] = tint.length > 3 ? tint[3] : 1;
    batch.count += 1;
  }

  /** Total instance count (for the packed GPU buffer). */
  instanceCount() {
    let n = 0;
    for (const b of this.order) n += b.count;
    return n;
  }
}
