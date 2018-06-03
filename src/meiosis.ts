export interface Mapper<A, B> {
  (value: A): B;
}

export interface Stream<T> {
  /**
   * Gets the latest value from the stream.
   */
  (): T;

  /**
   * Pushes a new value onto the stream.
   */
  (value: T): Stream<T>;

  /**
   * Maps over a stream.
   */
  map<R>(mapper: Mapper<T, R>): Stream<R>;
}

export interface TraceParameters<M> {
  update: Stream<any>;
  dataStreams: Array<Stream<any>>;
  otherStreams?: Array<Stream<any>>;
  toJS?: Function;
  fromJS?: Function;
  toUpdate?: Function;
}

export function isMeiosisTracerOn(): boolean {
  return window && window["__MEIOSIS_TRACER_GLOBAL_HOOK__"];
}

export function trace<M>(params: TraceParameters<M>): void {
  if (!params.update || !params.dataStreams) {
    throw new Error("Please specify update and dataStreams.");
  }

  /*
  Any change to lastStream automatically re-renders the view.

  "Live" changes are changes to the update stream.

  Keep track of the date of the last live change with the liveChange date.

  1. Live change
  - update the liveChange date
  - since liveChange !== lastChange, update=true
  - set lastChange = liveChange
  - send values to tracer with update=true. This will add to the tracer's history
    and increase the slider max.

  2. Time-travel change
  - receive MEIOSIS_RENDER_MODEL with sendValuesBack=false
  - send the data to the first stream, which then goes thru all streams
  - the view automatically re-renders
  - since liveChange === lastChange, update=false
  - don't send anything back to the tracer.

  3. Typing in model textarea
  - receive MEIOSIS_RENDER_MODEL with sendValuesBack=true. The tracer needs to be
    sent the computed values from the other streams.
  - send the data to the first stream, which then goes thru all streams
  - the view automatically re-renders
  - since liveChange === lastChange, update=false
  - since sendValuesBack=true, send the values to the tracer. But, update=false so
    this will not add to the tracer's history.

  4. Changes in otherStreams
  - initially send the ids of the streams
  - send new values with ids
  */

  if (isMeiosisTracerOn()) {
    const toJS: Function = params.toJS || ((model: M) => JSON.parse(JSON.stringify(model)));
    const fromJS: Function = params.fromJS || ((model: M) => model);
    const toUpdate: Function = params.toUpdate || ((model: any) => () => model);
    const bufferedValues: any[] = [];
    const bufferedStreamValues: any[] = [];
    let devtoolInitialized: boolean = false;
    let sendValues: boolean = true;

    let liveChange = true;

    const lastStream = params.dataStreams[params.dataStreams.length - 1];

    const otherStreamIds: string[] = [];
    const otherStreamsById: any = {};

    if (params.otherStreams && params.otherStreams.length) {
      params.otherStreams.forEach((otherStream: Stream<any>) => {
        const streamId: string = "stream_" + new Date().getTime();
        otherStreamIds.push(streamId);
        otherStreamsById[streamId] = otherStream;

        otherStream.map((value: any) => {
          const data: any = { type: "MEIOSIS_STREAM_VALUE", value, streamId };

          if (devtoolInitialized) {
            window.postMessage(data, "*");
          }
          else {
            bufferedStreamValues.push(data);
          }
        });
      });
    }

    window.addEventListener("message", (evt: any) => {
      if (evt.data.type === "MEIOSIS_RENDER_MODEL") {
        sendValues = evt.data.sendValuesBack;
        liveChange = false;
        params.update(toUpdate(fromJS(evt.data.model)));
      }
      else if (evt.data.type === "MEIOSIS_TRACER_INIT") {
        devtoolInitialized = true;

        if (otherStreamIds.length > 0) {
          window.postMessage({ type: "MEIOSIS_STREAM_IDS", streamIds: otherStreamIds }, "*");
        }
        bufferedValues.forEach((values: any) =>
          window.postMessage({ type: "MEIOSIS_VALUES", values, update: true }, "*"));
        bufferedStreamValues.forEach((data: any) => window.postMessage(data, "*"));
      }
      else if (evt.data.type === "MEIOSIS_TRIGGER_STREAM_VALUE") {
        const streamId: string = evt.data.streamId;
        const value: any = evt.data.value;

        otherStreamsById[streamId](value);
      }
    });

    lastStream.map(() => {
      if (sendValues || liveChange) {
        const values: any[] = params.dataStreams.map((stream: Stream<any>) =>
          ({ value: toJS(stream()) }));

        if (devtoolInitialized) {
          window.postMessage({ type: "MEIOSIS_VALUES", values, update: true }, "*");
        }
        else {
          bufferedValues.push(values);
        }
      }
      liveChange = true;
    });

    // Send ping in case tracer was already loaded.
    window.postMessage({ type: "MEIOSIS_PING" }, "*");
  }
}
