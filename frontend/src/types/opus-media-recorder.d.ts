declare module "opus-media-recorder" {
  export interface OpusMediaRecorderWorkerOptions {
    encoderWorkerFactory: () => Worker;
    OggOpusEncoderWasmPath: string;
    WebMOpusEncoderWasmPath: string;
  }

  export default class OpusMediaRecorder extends MediaRecorder {
    constructor(
      stream: MediaStream,
      options?: MediaRecorderOptions,
      workerOptions?: OpusMediaRecorderWorkerOptions
    );
  }
}
