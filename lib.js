const humanize = require("humanize");

class Controller {
  constructor(terminal) {
    this.terminal = terminal;
  }

  getInput() {
    return new Promise((resolve, reject) => {
      this.terminal.inputField((err, input) => {
        if (err) return reject(err);
        else return resolve(input);
      });
    });
  }
}

const convertBits = (bits, fixed = 0, exact = false) => {
  const data = {
    b: bits,
    kb: bits / 1024,
    mb: bits / 1024 / 1024,
    gb: bits / 1024 / 1024 / 1024
  };

  if (!exact) Object.entries(data).forEach(([unit, value]) => {
    data[unit] = value.toFixed(fixed);
  });

  return data;
};

const convertHz = (hz, fixed = 0, exact = false) => {
  hz = parseInt(hz);

  const data = {
    hz: hz,
    khz: hz / 1000,
    mhz: hz / 1000 / 1000
  };

  if (!exact) Object.entries(data).forEach(([unit, value]) => {
    data[unit] = value.toFixed(fixed);
  });

  return data;
};

const convertFileSize = (size) => {
  return (size) ? humanize.filesize(size) : "??? size";
}

module.exports = {
  Controller,
  convertBits,
  convertHz,
  convertFileSize
};