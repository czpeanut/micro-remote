let 指令 = ""
let 力道 = 0
let 上一拍 = 0
let 間隔 = 0
let 速度 = 0
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    指令 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
    if (指令 == "bar") {
        basic.showIcon(IconNames.EighthNote)
    } else if (指令 == "end") {
        basic.showIcon(IconNames.Happy)
        music.play(music.builtInPlayableMelody(Melodies.Entertainer), music.PlaybackMode.InBackground)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    力道 = input.acceleration(Dimension.Strength)
    if (力道 > 1800 && input.runningTime() - 上一拍 > 300) {
        間隔 = input.runningTime() - 上一拍
        上一拍 = input.runningTime()
        bluetooth.uartWriteString("beat#")
        if (間隔 < 2000) {
            速度 = Math.round(60000 / 間隔)
            bluetooth.uartWriteValue("t", 速度)
        }
        led.toggle(2, 2)
    }
    bluetooth.uartWriteValue("x", input.acceleration(Dimension.X))
    basic.pause(50)
})
