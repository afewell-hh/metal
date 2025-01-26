package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"go.githedgehog.com/fabric/api/meta"
	wiringapi "go.githedgehog.com/fabric/api/wiring/v1beta1"
)

func main() {
	// Read all .go files from switch_profiles
	files, err := filepath.Glob("switch_profiles/*.go")
	if err != nil {
		panic(err)
	}

	for _, file := range files {
		// Read the Go file
		content, err := ioutil.ReadFile(file)
		if err != nil {
			panic(err)
		}

		// Parse the profile
		var profile wiringapi.SwitchProfile
		// TODO: Parse Go file to get profile

		// Convert to JSON
		jsonData, err := json.MarshalIndent(profile, "", "  ")
		if err != nil {
			panic(err)
		}

		// Write JSON file
		outFile := filepath.Join("src/frontend/switch_profiles", strings.TrimSuffix(filepath.Base(file), ".go")+".json")
		err = ioutil.WriteFile(outFile, jsonData, 0644)
		if err != nil {
			panic(err)
		}

		fmt.Printf("Converted %s to %s\n", file, outFile)
	}
}
