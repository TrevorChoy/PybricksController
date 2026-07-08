const PYBRICKS_SERVICE_UUID =
  "c5f50001-8280-46da-89f4-6d8051e4aeef";

const PYBRICKS_COMMAND_EVENT_CHAR_UUID =
  "c5f50002-8280-46da-89f4-6d8051e4aeef";

const EVENT_WRITE_STDOUT = 0x01;
const COMMAND_WRITE_STDIN = 0x06;

const NUM_KEYS = 36;
const NUM_BYTES = 5;

let commandEventCharacteristic = null;
let connected = false;

const keysArray = new Array(NUM_KEYS).fill(false);

const connectionDisplay = document.getElementById("hubStatus");
const instructionsDisplay = document.getElementById("instructions");
const keysPressedDisplay = document.getElementById("keysPressed");

function keysToBytes() {
  const data = new Uint8Array(NUM_BYTES);

  for (let i = 0; i < NUM_KEYS; i++) {
    if (keysArray[i]) {
      data[Math.floor(i / 8)] |= 1 << (i % 8);
    }
  }

  return data;
}

function getKeyIndexFromCode(code) {
  // Physical letter keys: KeyA, KeyB, ..., KeyZ
  if (code.length === 4 && code.startsWith("Key")) {
    const letter = code[3]; // A-Z
    return letter.charCodeAt(0) - "A".charCodeAt(0);
  }

  // Physical number keys: Digit0, Digit1, ..., Digit9
  if (code.length === 6 && code.startsWith("Digit")) {
    const digit = code[5]; // 0-9
    return 26 + digit.charCodeAt(0) - "0".charCodeAt(0);
  }

  return null;
}

let sending = false;
let sendAgain = false;

async function sendKeyboardState() {
    if (sending) {
        sendAgain = true;
        return;
    }

    sending = true;

    do {
        sendAgain = false;

        const keyBytes = keysToBytes();

        const packet = new Uint8Array(1 + NUM_BYTES);
        packet[0] = COMMAND_WRITE_STDIN;
        packet.set(keyBytes, 1);

        await commandEventCharacteristic.writeValueWithResponse(packet);

    } while (sendAgain);

    sending = false;
}

function setKeyState(event, isPressed) {
  const index = getKeyIndexFromCode(event.code);

  if (index === null) {
    return;
  }

  keysArray[index] = isPressed;

  // Optional, but useful if the page has buttons/input focus.
  event.preventDefault();
}

window.addEventListener("keydown", (event) => {
  setKeyState(event, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event, false);
});

window.addEventListener("blur", () => {
  keysArray.fill(false);
});

function handlePybricksNotification(event) {
  const value = event.target.value;

  const data = new Uint8Array(
    value.buffer,
    value.byteOffset,
    value.byteLength
  );

  if (data.length === 0) {
    return;
  }

  if (data[0] !== EVENT_WRITE_STDOUT) {
    return;
  }

  const payload = data.slice(1);
  const text = new TextDecoder().decode(payload);

  if (text === "rdy") {
    sendKeyboardState();
    console.log("sending keyboard state")
  } else {
    console.log("Hub:", text);
  }
}

async function connectToHub() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      {
        services: [PYBRICKS_SERVICE_UUID],
      },
    ],
  });

  device.addEventListener("gattserverdisconnected", () => {
    connected = false;
    commandEventCharacteristic = null;
    console.log("Disconnected.");

    connectionDisplay.style.backgroundColor = "palevioletred";
    connectionDisplay.textContent = "Hub Disconnected";

    instructionsDisplay.textContent = "Exit program on hub and ensure the Bluetooth light is flashing.";
  });

  const server = await device.gatt.connect();

  const service = await server.getPrimaryService(
    PYBRICKS_SERVICE_UUID
  );

  commandEventCharacteristic = await service.getCharacteristic(
    PYBRICKS_COMMAND_EVENT_CHAR_UUID
  );

  await commandEventCharacteristic.startNotifications();

  commandEventCharacteristic.addEventListener(
    "characteristicvaluechanged",
    handlePybricksNotification
  );

  connected = true;
  connectionDisplay.style.backgroundColor = "palegreen";
  connectionDisplay.textContent = "Hub Connected";

  instructionsDisplay.textContent = "Start program to control with keyboard.";

  console.log("Connected. Start the Pybricks program on the hub.");
}