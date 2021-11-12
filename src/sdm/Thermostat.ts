import _ from 'lodash';
import {Device} from "./Device";
import * as Traits from "./Traits";
import * as Commands from "./Commands";
import * as Events from './Events';

export class Thermostat extends Device {

    private async convertToFahrenheitIfNecessary(input: number): Promise<number> {
        const unit = await this.getTemparatureUnits();
        if (unit === Traits.TemparatureScale.FAHRENHEIT)
            return (input * (9/5)) + 32;

        return input;
    }

    private async convertToCelsiusIfNecessary(input: number): Promise<number> {
        const unit = await this.getTemparatureUnits();
        if (unit === Traits.TemparatureScale.CELSIUS)
            return (input - 32) * (5/9);

        return input;
    }

    getDisplayName(): string {
        return this.displayName ? this.displayName + ' Thermostat' : 'Unknown';
    }

    onTemperatureChanged: ((temparature: number) => void) | undefined;
    onTemperatureUnitsChanged: ((scale: Traits.TemparatureScale) => void) | undefined;
    onModeChanged: ((mode: Traits.ThermostatModeType) => void) | undefined;
    onTargetTemperatureChanged: ((temparature: number) => void) | undefined;
    onHvacChanged: ((status: Traits.HvacStatusType) => void) | undefined;
    onHumidityChanged: ((humidity: number) => void) | undefined;

    event(event: Events.ResourceTraitEvent) {
        _.forEach(event.resourceUpdate.traits, (value, key) => {
            switch (key) {
                case Traits.Constants.ThermostatTemperatureSetpoint:
                    if (this.onTargetTemperatureChanged) {
                        const traitValue = value as Traits.ThermostatTemperatureSetpoint;
                        const target = traitValue.heatCelsius ? <number>traitValue.heatCelsius : <number>traitValue.coolCelsius;
                        this.onTargetTemperatureChanged(target);
                    }
                    break;
                case Traits.Constants.ThermostatHvac:
                    if (this.onHvacChanged) {
                        const traitValue = value as Traits.ThermostatHvac;
                        this.onHvacChanged(traitValue.status);
                    }
                    break;
                case Traits.Constants.Humidity:
                    if (this.onHumidityChanged) {
                        const traitVale = value as Traits.Humidity;
                        this.onHumidityChanged(traitVale.ambientHumidityPercent);
                    }
                    break;
                case Traits.Constants.ThermostatMode:
                    if (this.onModeChanged) {
                        const traitVale = value as Traits.ThermostatMode;
                        this.onModeChanged(traitVale.mode);
                    }
                    break;
                case Traits.Constants.Temperature:
                    if (this.onTemperatureChanged) {
                        const traitVale = value as Traits.Temperature;
                        this.onTemperatureChanged(traitVale.ambientTemperatureCelsius);
                    }
                    break;
                case Traits.Constants.Settings:
                    if (this.onTemperatureUnitsChanged) {
                        const traitVale = value as Traits.Settings;
                        this.onTemperatureUnitsChanged(traitVale.temparatureScale!);
                    }
                    break;
            }
        })
    }

    async getEco(): Promise<Traits.EcoModeType> {
        const trait =  await this.getTrait<Traits.ThermostatEco>(Traits.Constants.ThermostatEco);
        return trait.mode;
    }

    async getMode(): Promise<Traits.ThermostatModeType> {
        const trait =  await this.getTrait<Traits.ThermostatMode>(Traits.Constants.ThermostatMode);
        return trait.mode;
    }

    async getHvac(): Promise<Traits.HvacStatusType> {
        const trait =  await this.getTrait<Traits.ThermostatHvac>(Traits.Constants.ThermostatHvac);
        return trait.status;
    }

    async getTemparature(): Promise<number> {
        const trait =  await this.getTrait<Traits.Temperature>(Traits.Constants.Temperature);
        return this.convertToFahrenheitIfNecessary(trait.ambientTemperatureCelsius);
    }

    async getTargetTemparature(): Promise<number|undefined> {

        const eco = await this.getEco();

        if (eco !== Traits.EcoModeType.OFF)
            return Promise.resolve(undefined);

        const trait =  await this.getTrait<Traits.ThermostatTemperatureSetpoint>(Traits.Constants.ThermostatTemperatureSetpoint);
        const mode = await this.getMode();

        switch (mode) {
            case Traits.ThermostatModeType.OFF:
                return Promise.resolve(undefined);
            case Traits.ThermostatModeType.HEAT:
                return this.convertToFahrenheitIfNecessary(trait.heatCelsius!);
            case Traits.ThermostatModeType.COOL:
                return this.convertToFahrenheitIfNecessary(trait.coolCelsius!);
            case Traits.ThermostatModeType.HEATCOOL:
                //todo: what to return here?
                return Promise.resolve(undefined);
        }
    }

    async setTemparature(temparature:number): Promise<void> {
        const eco = await this.getEco();

        if (eco !== Traits.EcoModeType.OFF)
            return Promise.resolve(undefined);

        const mode = await this.getMode();
        const temparatureCelsius = await this.convertToCelsiusIfNecessary(temparature);

        switch (mode) {
            case Traits.ThermostatModeType.HEAT:
                return await this.executeCommand<Commands.ThermostatTemperatureSetpoint_SetHeat, void>(Commands.Constants.ThermostatTemperatureSetpoint_SetHeat, {
                    heatCelsius: temparatureCelsius
                });
            case Traits.ThermostatModeType.COOL:
                return await this.executeCommand<Commands.ThermostatTemperatureSetpoint_SetCool, void>(Commands.Constants.ThermostatTemperatureSetpoint_SetCool, {
                    coolCelsius: temparatureCelsius
                });
            case Traits.ThermostatModeType.HEATCOOL:
                //todo: what to do here?
                return Promise.resolve(undefined);
        }
    }

    async setMode(mode:Traits.ThermostatModeType): Promise<void> {
        await this.executeCommand<Commands.ThermostatMode_SetMode, void>(Commands.Constants.ThermostatMode_SetMode, {
            mode: mode
        });
    }

    async getTemparatureUnits(): Promise<Traits.TemparatureScale> {
        const settings = await this.getTrait<Traits.Settings>(Traits.Constants.Settings);
        return settings.temparatureScale!;
    }

    async getRelativeHumitity(): Promise<number> {
        const humidity = await this.getTrait<Traits.Humidity>(Traits.Constants.Humidity);
        return humidity.ambientHumidityPercent;
    }
}
