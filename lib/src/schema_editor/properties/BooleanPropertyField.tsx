import React from "react";
import { Grid, Paper, Typography } from "@mui/material";
import {
    GeneralPropertyValidation
} from "../properties_advanced/validation/GeneralPropertyValidation";

export function BooleanPropertyField() {

    return (
        <>
            <Grid item >
                <Typography variant={"subtitle2"} >
                    Validation
                </Typography>
                <Paper variant={"outlined"} sx={{ p: 2, mt: 1 }}>
                    <GeneralPropertyValidation/>
                </Paper>
            </Grid>
        </>
    );
}
