let 指令 = ""
let 油門 = 0
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    指令 = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
    if (指令 == "star") {
        basic.showIcon(IconNames.Diamond)
    } else if (指令 == "ring") {
        basic.showIcon(IconNames.Target)
    } else if (指令 == "crash") {
        basic.showIcon(IconNames.Skull)
    } else if (指令 == "end") {
        basic.showIcon(IconNames.Happy)
    }
})
bluetooth.startUartService()
basic.showIcon(IconNames.No)
basic.forever(function () {
    bluetooth.uartWriteValue("x", input.acceleration(Dimension.X))
    bluetooth.uartWriteValue("y", input.acceleration(Dimension.Y))
    if (input.buttonIsPressed(Button.A)) {
        油門 = 1
    } else if (input.buttonIsPressed(Button.B)) {
        油門 = 2
    } else {
        油門 = 0
    }
    bluetooth.uartWriteValue("b", 油門)
    basic.pause(100)
})
