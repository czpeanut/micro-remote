let 指令 = ""
let 旋鈕 = 0
let 按鍵 = 0
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    指令 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
    if (指令 == "go") {
        basic.showArrow(ArrowNames.North)
        music.play(music.tonePlayable(1047, music.beat(BeatFraction.Half)), music.PlaybackMode.InBackground)
    } else if (指令 == "lap") {
        basic.showIcon(IconNames.Yes)
        music.play(music.tonePlayable(880, music.beat(BeatFraction.Eighth)), music.PlaybackMode.InBackground)
    } else if (指令 == "end") {
        basic.showIcon(IconNames.Happy)
        music.play(music.builtInPlayableMelody(Melodies.PowerUp), music.PlaybackMode.InBackground)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    旋鈕 = pins.analogReadPin(AnalogReadWritePin.P1)
    按鍵 = 0
    if (tinkercademy.ADKeyboard(ADKeys.A, AnalogPin.P2)) {
        按鍵 = 1
    } else if (tinkercademy.ADKeyboard(ADKeys.B, AnalogPin.P2)) {
        按鍵 = 2
    } else if (tinkercademy.ADKeyboard(ADKeys.C, AnalogPin.P2)) {
        按鍵 = 3
    } else if (tinkercademy.ADKeyboard(ADKeys.D, AnalogPin.P2)) {
        按鍵 = 4
    } else if (tinkercademy.ADKeyboard(ADKeys.E, AnalogPin.P2)) {
        按鍵 = 5
    }
    bluetooth.uartWriteValue("k", 旋鈕)
    bluetooth.uartWriteValue("b", 按鍵)
    basic.pause(100)
})
